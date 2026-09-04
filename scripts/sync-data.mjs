/**
 * 공공데이터(E-Gen) 약국 / 병의원 전체 목록을 내려받아
 * 앱에 번들할 정적 데이터셋을 만든다.
 *
 *   npm run sync:data              캐시가 있으면 재사용
 *   npm run sync:data -- --refresh 캐시를 무시하고 다시 받기
 *
 * .env 의 DATA_GO_KR_SERVICE_KEY(인코딩된 키)를 사용한다.
 * 개발계정은 하루 1,000건 제한이라 원본 응답을 .cache/ 에 저장해두고
 * 출력 포맷만 손볼 때는 API를 다시 부르지 않는다.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { parseAddress, baseEmd } from './address.mjs';
import { createCoverageFilter, describeCoverage, getCoverage } from './coverage.mjs';
import { SERVICES, fetchAll } from './egen.mjs';
import { emit } from './emit.mjs';
import { syncHolidays } from './sync-holidays.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DATA_DIR = path.join(ROOT, 'src', 'data');
const CACHE_DIR = path.join(ROOT, '.cache');

const SOURCE =
  '국립중앙의료원 전국 약국 정보 조회 서비스 / 전국 병·의원 찾기 서비스 (공공데이터포털)';

async function loadServiceKey() {
  if (process.env.DATA_GO_KR_SERVICE_KEY) return process.env.DATA_GO_KR_SERVICE_KEY.trim();
  for (const file of ['.env.local', '.env']) {
    try {
      const text = await readFile(path.join(ROOT, file), 'utf8');
      const match = text.match(/^\s*DATA_GO_KR_SERVICE_KEY\s*=\s*(.+)$/m);
      if (match) return match[1].trim().replace(/^["']|["']$/g, '');
    } catch {
      // 파일이 없으면 다음 후보로 넘어간다.
    }
  }
  throw new Error(
    '공공데이터포털 서비스 키가 없어요.\n' +
      '.env 파일에 DATA_GO_KR_SERVICE_KEY=<인코딩된 키> 를 넣어주세요.',
  );
}

const HOUR_KEYS = Array.from({ length: 8 }, (_, i) => [`dutyTime${i + 1}s`, `dutyTime${i + 1}c`]);

function toMinutes(value) {
  if (!value) return null;
  const digits = String(value).replace(/\D/g, '');
  if (digits.length !== 4) return null;
  const hour = Number(digits.slice(0, 2));
  const minute = Number(digits.slice(2));
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null;
  // 새벽 마감(예: 2400, 2530)을 그대로 분으로 환산해 자정 넘김을 표현한다.
  return hour * 60 + minute;
}

function readHours(row) {
  const hours = [];
  let hasAny = false;
  for (const [openKey, closeKey] of HOUR_KEYS) {
    const open = toMinutes(row[openKey]);
    const close = toMinutes(row[closeKey]);
    if (open != null && close != null) hasAny = true;
    hours.push(open ?? -1, close ?? -1);
  }
  return hasAny ? hours : null;
}

const HOSPITAL_KIND = new Map([
  ['A', '상급종합병원'], ['B', '종합병원'], ['C', '병원'], ['D', '의원'],
  ['E', '요양병원'], ['F', '보건소'], ['G', '한방병원'], ['H', '한의원'],
  ['I', '치과병원'], ['J', '치과의원'], ['K', '조산원'], ['L', '보건지소'],
  ['M', '보건진료소'], ['N', '약국'], ['O', '보건의료원'], ['U', '정신병원'],
]);

function normalizeRow(row, type) {
  const lat = Number(row.wgs84Lat);
  const lng = Number(row.wgs84Lon);
  const address = (row.dutyAddr ?? '').trim();
  const parsed = parseAddress(address);
  if (!parsed) return null;

  const kind =
    type === 'pharmacy'
      ? '약국'
      : row.dutyDivNam || HOSPITAL_KIND.get(row.dutyDiv) || '의료기관';

  return {
    name: (row.dutyName ?? '').trim(),
    address,
    tel: (row.dutyTel1 ?? '').replace(/\s+/g, ''),
    lat: Number.isFinite(lat) ? lat : null,
    lng: Number.isFinite(lng) ? lng : null,
    type,
    kind,
    emergency: row.dutyEryn === '1',
    note: (row.dutyEtc ?? '').trim() || null,
    hours: readHours(row),
    sido: parsed.sido,
    sigungu: parsed.sigungu,
    emd: baseEmd(parsed.emd),
  };
}

async function collect(type, serviceKey, { refresh }) {
  const cacheFile = path.join(CACHE_DIR, `raw-${type}.json`);
  const label = type === 'pharmacy' ? '약국' : '병·의원';

  if (!refresh) {
    try {
      const cached = JSON.parse(await readFile(cacheFile, 'utf8'));
      console.log(`  ${label} 캐시 재사용 ${cached.length.toLocaleString()}건`);
      return cached;
    } catch {
      // 캐시가 없으면 그냥 받아온다.
    }
  }

  const service = SERVICES[type];
  const report = (count, total) => {
    const suffix = total ? ` / ${total.toLocaleString()}` : '';
    process.stdout.write(`\r  ${label} ${count.toLocaleString()}${suffix}건 수집`);
  };

  let rows;
  try {
    rows = await fetchAll({ serviceKey, service, operation: service.full, pageSize: 1000, onProgress: report });
  } catch (error) {
    process.stdout.write('\n');
    console.warn(`  ! 전체 내려받기(${service.full}) 실패 — 목록 API로 대체해요: ${error.message}`);
    rows = await fetchAll({ serviceKey, service, operation: service.list, pageSize: 1000, onProgress: report });
  }
  process.stdout.write('\n');

  await mkdir(CACHE_DIR, { recursive: true });
  await writeFile(cacheFile, JSON.stringify(rows));
  return rows;
}

async function main() {
  const refresh = process.argv.includes('--refresh');
  const serviceKey = await loadServiceKey();

  console.log('공공데이터 수집을 시작해요.');
  const raw = [];
  for (const type of ['pharmacy', 'hospital']) {
    const rows = await collect(type, serviceKey, { refresh });
    raw.push(...rows.map((row) => normalizeRow(row, type)).filter(Boolean));
  }

  const usable = raw.filter((place) => place.name && place.lat != null && place.lng != null);
  const dropped = raw.length - usable.length;
  console.log(`정규화 완료: ${usable.length.toLocaleString()}건 (좌표 없는 ${dropped.toLocaleString()}건 제외)`);

  const coverage = getCoverage();
  const coverageLabel = describeCoverage(coverage);
  const places = usable.filter(createCoverageFilter(coverage));
  console.log(`대상 지역(${coverageLabel})으로 좁힘: ${places.length.toLocaleString()}건`);
  if (places.length === 0) {
    throw new Error(`"${coverageLabel}" 에 해당하는 시설이 없어요. scripts/coverage.mjs 의 지역 표기를 확인해 주세요.`);
  }

  const { sigunguCount, dongCount } = await emit({
    places,
    dataDir: DATA_DIR,
    source: SOURCE,
    coverage: coverageLabel,
  });

  const year = new Date().getFullYear();
  try {
    const days = await syncHolidays(serviceKey, [year, year + 1]);
    console.log(`공휴일 ${Object.keys(days).length}일을 갱신했어요.`);
  } catch (error) {
    console.warn(`공휴일 갱신은 건너뛰어요 (기본값 사용): ${error.message}`);
  }

  console.log('\n완료했어요.');
  console.log(`  시군구 ${sigunguCount}곳 · 동 ${dongCount}곳 · 시설 ${places.length.toLocaleString()}곳`);
  console.log('  → src/data/regions.json, src/data/places/*.json, src/data/holidays.json');
}

main().catch((error) => {
  console.error(`\n${error.message}`);
  process.exitCode = 1;
});

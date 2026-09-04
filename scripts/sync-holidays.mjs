/**
 * 한국천문연구원 특일 정보 API에서 공휴일 목록을 받아 src/data/holidays.json 을 갱신한다.
 * 키가 없거나 활용신청이 안 돼 있으면 기존 기본값을 그대로 두고 경고만 남긴다.
 */
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { parseItems, readError } from './egen.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TARGET = path.join(ROOT, 'src', 'data', 'holidays.json');
const ENDPOINT = 'https://apis.data.go.kr/B090041/openapi/service/SpcdeInfoService/getRestDeInfo';

/**
 * 특일 정보 API는 근로자의날도 공휴일로 내려주는데, 이건 관공서 공휴일이 아니다.
 * E-Gen 의 dutyTime8(공휴일)은 관공서 공휴일 기준이라, 근로자의날을 공휴일로 치면
 * 그날 실제로 문 여는 병·의원을 대부분 놓치게 된다.
 */
const NOT_PUBLIC_OFFICE_HOLIDAY = /(근로자의?\s*날|노동절)/;

export async function syncHolidays(serviceKey, years) {
  const days = {};

  for (const year of years) {
    const url = `${ENDPOINT}?serviceKey=${serviceKey}&solYear=${year}&numOfRows=100&_type=xml`;
    const res = await fetch(url, { headers: { Accept: 'application/xml' } });
    const xml = await res.text();
    const error = readError(xml);
    if (error) throw new Error(`${year}년 특일 정보 조회 실패: ${error}`);

    for (const item of parseItems(xml)) {
      if (item.isHoliday !== 'Y') continue;
      const raw = String(item.locdate ?? '');
      if (raw.length !== 8) continue;
      const name = item.dateName ?? '공휴일';
      if (NOT_PUBLIC_OFFICE_HOLIDAY.test(name)) continue;
      const date = `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6)}`;
      days[date] = name;
    }
  }

  if (Object.keys(days).length === 0) throw new Error('공휴일이 하나도 조회되지 않았어요.');

  const sorted = Object.fromEntries(Object.entries(days).sort(([a], [b]) => a.localeCompare(b)));
  const payload = {
    generatedAt: new Date().toISOString(),
    source: '한국천문연구원 특일 정보 (공공데이터포털)',
    days: sorted,
  };
  await writeFile(TARGET, `${JSON.stringify(payload, null, 2)}\n`);
  return sorted;
}

async function main() {
  const key = process.env.DATA_GO_KR_SERVICE_KEY?.trim();
  if (!key) throw new Error('DATA_GO_KR_SERVICE_KEY 가 없어요.');
  const thisYear = new Date().getFullYear();
  const days = await syncHolidays(key, [thisYear, thisYear + 1]);
  console.log(`공휴일 ${Object.keys(days).length}일을 갱신했어요.`);
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1].replace(/\\/g, '/')}`).href) {
  main().catch(async (error) => {
    const current = JSON.parse(await readFile(TARGET, 'utf8'));
    console.warn(`공휴일 갱신을 건너뛰어요: ${error.message}`);
    console.warn(`  기본값 ${Object.keys(current.days).length}일을 그대로 사용해요.`);
  });
}

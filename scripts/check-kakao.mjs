/**
 * 카카오맵 JS 키가 실제로 지도를 내려줄 수 있는 상태인지 확인한다.
 *
 *   npm run check:kakao
 *   npm run check:kakao -- https://내도메인.com   (도메인 추가 확인)
 *
 * 브라우저에서는 SDK 응답에 CORS 헤더가 없어서 실패 사유를 읽을 수 없다.
 * (앱이 "지도를 불러오지 못했어요"까지만 말할 수 있는 이유다.)
 * Node 에는 그 제약이 없으므로, 여기서 Referer 를 바꿔가며 직접 물어보고
 * 카카오 콘솔에서 뭘 고쳐야 하는지까지 짚어준다.
 */
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SDK = 'https://dapi.kakao.com/v2/maps/sdk.js';

/**
 * 지도가 떠야 하는 곳들. 하나라도 빠지면 그 화면만 기본 지도로 대체된다.
 * 배포처는 GitHub Pages 한 곳이다. (앱인토스에는 등록하지 않기로 했다)
 */
const ORIGINS = [
  { url: 'http://localhost:5173', label: '로컬 개발 (npm run dev)' },
  { url: 'http://localhost:4173', label: '웹 배포 미리보기 (npm run build:web)' },
  { url: 'https://kjnewsletter.github.io', label: 'GitHub Pages 배포본' },
];

async function loadKey() {
  if (process.env.VITE_KAKAO_MAP_KEY) return process.env.VITE_KAKAO_MAP_KEY.trim();
  for (const file of ['.env.local', '.env']) {
    try {
      const text = await readFile(path.join(ROOT, file), 'utf8');
      const match = text.match(/^\s*VITE_KAKAO_MAP_KEY\s*=\s*(.+)$/m);
      if (match) return match[1].trim().replace(/^["']|["']$/g, '');
    } catch {
      // 파일이 없으면 다음 후보로 넘어간다.
    }
  }
  throw new Error(
    '카카오맵 JavaScript 키가 없어요.\n' +
      '.env 파일에 VITE_KAKAO_MAP_KEY=<JavaScript 키> 를 넣어주세요.',
  );
}

/**
 * @returns {Promise<{ ok: boolean, errorType?: string, message?: string }>}
 */
async function ask(key, referer) {
  const url = `${SDK}?appkey=${encodeURIComponent(key)}&autoload=false`;
  const res = await fetch(url, { headers: referer ? { Referer: `${referer}/` } : {} });
  const body = await res.text();
  if (res.ok && !body.startsWith('{')) return { ok: true };
  try {
    const { errorType, message } = JSON.parse(body);
    return { ok: false, errorType, message };
  } catch {
    return { ok: false, message: `HTTP ${res.status}` };
  }
}

async function main() {
  const key = await loadKey();
  console.log(`JavaScript 키: ${key.slice(0, 8)}… (${key.length}자)\n`);

  // Referer 없이 물으면 도메인 검사를 건너뛰므로, 키 자체와 제품 설정 상태가 드러난다.
  const bare = await ask(key, null);
  if (!bare.ok && bare.errorType === 'NotAuthorizedError') {
    console.log('✗ 카카오맵 API 가 꺼져 있어요.');
    console.log(`  ${bare.message}`);
    console.log('  → developers.kakao.com/console/app > 앱 선택 > [카카오맵] > [사용 설정] > [상태] 를 ON.');
    console.log('    (이게 꺼져 있으면 도메인을 다 등록해도 지도가 뜨지 않아요.)\n');
  } else if (!bare.ok && bare.errorType && bare.errorType !== 'AccessDeniedError') {
    console.log(`✗ 키를 쓸 수 없어요: ${bare.errorType} — ${bare.message}`);
    console.log('  → 앱 키 중 "JavaScript 키"가 맞는지 확인해 주세요. (REST API 키가 아니에요)\n');
  } else {
    console.log('✓ 키가 살아 있고 카카오맵 API 도 켜져 있어요.\n');
  }

  const extra = process.argv.slice(2).map((url) => ({ url: url.replace(/\/$/, ''), label: '직접 지정' }));
  const targets = [...ORIGINS, ...extra];
  const missing = [];

  console.log('JavaScript SDK 도메인 등록 상태');
  for (const { url, label } of targets) {
    const result = await ask(key, url);
    if (result.ok) {
      console.log(`  ✓ ${url}  — ${label}`);
    } else if (result.errorType === 'AccessDeniedError') {
      console.log(`  ✗ ${url}  — ${label} (미등록)`);
      missing.push(url);
    } else {
      // 카카오맵 API 가 꺼져 있으면 도메인이 맞아도 여기서 걸린다. 위에서 이미 안내했다.
      console.log(`  ? ${url}  — ${label} (${result.errorType ?? result.message})`);
    }
  }

  if (missing.length > 0) {
    console.log('\n[앱] > [플랫폼 키] > [JavaScript 키] > [JavaScript SDK 도메인] 에 아래를 등록해 주세요.');
    for (const url of missing) console.log(`  ${url}`);
    console.log('\n등록 후 dev 서버를 다시 켜고 이 명령을 한 번 더 돌려보세요.');
    process.exitCode = 1;
  } else {
    console.log('\n모두 등록돼 있어요. 지도가 안 뜨면 dev 서버를 다시 켜보세요.');
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});

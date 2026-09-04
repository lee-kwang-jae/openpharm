/**
 * GitHub Pages 배포본을 로컬에서 그대로 확인하는 정적 서버.
 *
 * Pages 는 https://kjnewsletter.github.io/openpharm/ 처럼 하위 경로로 서비스돼서,
 * dist 를 루트에 올려놓고 보면 자산 경로(/openpharm/assets/...)가 전부 404 난다.
 * 그래서 실제 배포와 같은 경로 구조로 흉내 내서 띄운다.
 *
 *   npm run build:web && node scripts/preview-web.mjs
 *   → http://localhost:4173/openpharm/
 */
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(ROOT, 'dist');
const BASE = process.env.DEPLOY_BASE ?? '/openpharm/';
const PORT = Number(process.env.PORT ?? 4173);

const TYPES = new Map([
  ['.html', 'text/html; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.css', 'text/css; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.png', 'image/png'],
  ['.svg', 'image/svg+xml'],
  ['.ico', 'image/x-icon'],
]);

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', `http://localhost:${PORT}`);

  if (!url.pathname.startsWith(BASE)) {
    res.writeHead(302, { Location: BASE });
    res.end();
    return;
  }

  const relative = url.pathname.slice(BASE.length) || 'index.html';
  // 경로 조작으로 dist 바깥 파일을 읽지 못하게 막는다.
  const target = path.resolve(DIST, relative);
  if (!target.startsWith(DIST)) {
    res.writeHead(403).end('Forbidden');
    return;
  }

  let filePath = target;
  try {
    const info = await stat(filePath);
    if (info.isDirectory()) filePath = path.join(filePath, 'index.html');
  } catch {
    // SPA 라 없는 경로는 index.html 로 넘긴다.
    filePath = path.join(DIST, 'index.html');
  }

  try {
    await stat(filePath);
  } catch {
    res.writeHead(404).end('Not found');
    return;
  }

  res.writeHead(200, { 'Content-Type': TYPES.get(path.extname(filePath)) ?? 'application/octet-stream' });
  createReadStream(filePath).pipe(res);
});

server.listen(PORT, () => {
  console.log(`배포본 미리보기: http://localhost:${PORT}${BASE}`);
});

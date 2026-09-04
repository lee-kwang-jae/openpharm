/**
 * GitHub Pages 용 빌드.
 *
 * 미니앱은 도메인 루트에서 돌지만 Pages 는 /openpharm/ 하위에 올라가서
 * base 경로가 달라야 한다. npm 스크립트에서 환경변수를 넘기는 문법이
 * 윈도우/유닉스가 달라서 전용 진입점으로 뺐다.
 *
 *   npm run build:web
 *   DEPLOY_BASE=/다른경로/ npm run build:web
 */
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const base = process.env.DEPLOY_BASE ?? '/openpharm/';

console.log(`base "${base}" 로 웹 빌드를 시작해요.`);

const result = spawnSync('npx', ['vite', 'build'], {
  cwd: ROOT,
  env: { ...process.env, DEPLOY_BASE: base },
  stdio: 'inherit',
  shell: process.platform === 'win32',
});

process.exitCode = result.status ?? 1;

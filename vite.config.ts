import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

import aitDevtools from '@apps-in-toss/devtools/unplugin';

// 토스 미니앱은 자기 도메인 루트에서 서비스되지만, GitHub Pages 는
// /openpharm/ 하위 경로에 올라간다. 그래서 base 를 빌드할 때 정한다.
//   npm run build      → 미니앱용 (base '/')
//   npm run build:web  → GitHub Pages 용 (base '/openpharm/')
const base = process.env.DEPLOY_BASE ?? '/';

export default defineConfig({
  base,
  plugins: [aitDevtools.vite(), react()],
});

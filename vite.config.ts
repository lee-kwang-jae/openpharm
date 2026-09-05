import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// 배포처는 GitHub Pages 한 곳이고, 저장소 이름 때문에 /openpharm/ 하위 경로로 서비스된다.
// dev 서버는 루트에서 돌기 때문에 build 일 때만 하위 경로를 붙인다.
// 예전에는 미니앱(base '/')과 Pages(base '/openpharm/') 두 벌을 만들어야 해서
// 기본값이 '/' 였는데, 그러면 그냥 build 한 결과물이 Pages 에서 깨진다.
export default defineConfig(({ command }) => ({
  base: command === 'serve' ? '/' : (process.env.DEPLOY_BASE ?? '/openpharm/'),
  plugins: [react()],
}));

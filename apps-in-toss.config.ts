import { defineConfig } from '@apps-in-toss/web-framework/config';

export default defineConfig({
  appName: 'holiday-care',
  brand: {
    primaryColor: '#3182F6',
  },
  // 현재 위치로 가까운 동을 찾을 때만 쓴다. 거부해도 동 이름 검색으로 전부 이용할 수 있다.
  permissions: [{ name: 'geolocation', access: 'access' }],
  webBundleDir: 'dist',
});

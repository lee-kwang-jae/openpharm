import { lightCSS } from '@toss/tds-colors';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import App from './App.tsx';
import './index.css';

// 색 토큰(var(--adaptiveGrey800) 같은 값)은 원래 TDS Provider 가 심어준다.
// TDS 는 앱인토스 도메인 밖에서 실행을 거부해서 걷어냈고, 대신 변수만 직접 넣는다.
// 다크 팔레트(darkCSS)도 패키지에 있지만, 화면을 라이트 기준으로만 검증해서
// 지금은 라이트로 고정한다.
const paletteStyle = document.createElement('style');
paletteStyle.textContent = `:root { color-scheme: light; ${lightCSS} }`;
document.head.appendChild(paletteStyle);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

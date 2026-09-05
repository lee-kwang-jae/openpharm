/**
 * 카카오맵 JS SDK 로더.
 * 토스 WebView는 외부 스크립트를 막지 않지만, 키가 없거나 도메인 등록이 안 돼 있으면
 * 조용히 실패하므로 항상 실패를 표면화해서 목록 화면으로 대체할 수 있게 한다.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
declare global {
  interface Window {
    kakao?: any;
  }
}

export const KAKAO_APP_KEY: string = import.meta.env.VITE_KAKAO_MAP_KEY ?? '';

/**
 * SDK 요청은 CORS 헤더가 없어서 실패 사유(도메인 미등록인지, 카카오맵 제품이 꺼져 있는지,
 * 키가 틀렸는지)를 브라우저에서 읽을 수 없다. 사유까지 알아내려면 CORS 제약이 없는 곳에서
 * 물어봐야 해서, 그 진단은 `npm run check:kakao` 로 옮겨뒀다.
 */
function explainFailure() {
  if (!import.meta.env.DEV) return;
  const origin = window.location.origin;
  console.warn(
    [
      '[카카오맵] 지도를 불러오지 못했어요.',
      '  사유까지 확인하려면 → npm run check:kakao',
      '',
      '  자주 걸리는 것들 (developers.kakao.com/console/app)',
      '  1. [카카오맵] > [사용 설정] > [상태] 가 ON 인지 (꺼져 있으면 도메인을 등록해도 안 떠요)',
      `  2. [앱] > [플랫폼 키] > [JavaScript 키] > [JavaScript SDK 도메인] 에 "${origin}" 을 등록했는지`,
      KAKAO_APP_KEY
        ? `  3. .env 의 VITE_KAKAO_MAP_KEY 가 "JavaScript 키"가 맞는지 (현재: ${KAKAO_APP_KEY.slice(0, 8)}…)`
        : '  3. .env 에 VITE_KAKAO_MAP_KEY 를 넣었는지',
      '  4. .env 를 고쳤다면 dev 서버를 다시 켰는지 (Vite는 .env 를 시작할 때만 읽어요)',
    ].join('\n'),
  );
}

const SDK_URL = (key: string) =>
  `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${encodeURIComponent(key)}&autoload=false`;

const LOAD_TIMEOUT_MS = 8000;

let pending: Promise<any> | null = null;

/**
 * 실패한 script 태그를 그대로 두면 다음 시도에서 재사용돼 load 이벤트가 영영 오지 않는다.
 * 콘솔 설정을 고치고 "다시 시도"를 눌렀을 때 진짜로 다시 받아오도록 지운다.
 */
function dropScript() {
  document.querySelector('script[data-kakao-maps]')?.remove();
}

export function loadKakaoMaps(): Promise<any> {
  if (window.kakao?.maps?.LatLng) return Promise.resolve(window.kakao.maps);
  if (pending) return pending;

  pending = new Promise((resolve, reject) => {
    if (!KAKAO_APP_KEY) {
      reject(new Error('카카오맵 JavaScript 키(VITE_KAKAO_MAP_KEY)가 설정되지 않았어요.'));
      return;
    }

    dropScript();
    const script = document.createElement('script');

    const timer = window.setTimeout(() => {
      reject(new Error('카카오맵을 불러오지 못했어요. (응답 없음)'));
    }, LOAD_TIMEOUT_MS);

    script.addEventListener('load', () => {
      if (!window.kakao?.maps) {
        window.clearTimeout(timer);
        reject(new Error('카카오맵 SDK가 로드되지 않았어요.'));
        return;
      }
      window.kakao.maps.load(() => {
        window.clearTimeout(timer);
        resolve(window.kakao.maps);
      });
    });

    script.addEventListener('error', () => {
      window.clearTimeout(timer);
      reject(new Error('카카오맵 스크립트를 내려받지 못했어요. 도메인 등록을 확인해 주세요.'));
    });

    script.dataset.kakaoMaps = 'true';
    script.async = true;
    script.src = SDK_URL(KAKAO_APP_KEY);
    document.head.appendChild(script);
  });

  pending = pending.catch((error) => {
    pending = null;
    dropScript();
    explainFailure();
    throw error;
  });

  return pending;
}

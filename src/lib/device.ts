/**
 * 기기 기능(클립보드·전화·위치)을 웹 표준 API로 감싼다.
 *
 * 예전에는 토스 브릿지를 먼저 시도하고 실패하면 웹으로 넘어갔지만,
 * 배포처가 GitHub Pages 한 곳이 되면서 브릿지가 쓰일 일이 없어져 걷어냈다.
 * 브라우저마다 되고 안 되고가 갈리는 자리라 실패는 호출한 쪽에 그대로 넘긴다.
 */

export async function copyText(text: string): Promise<void> {
  if (!navigator.clipboard) {
    throw new Error('이 브라우저에서는 복사를 쓸 수 없어요.');
  }
  await navigator.clipboard.writeText(text);
}

export async function openTel(tel: string): Promise<void> {
  const digits = tel.replace(/[^0-9+*#]/g, '');
  if (!digits) {
    throw new Error('전화번호가 올바르지 않아요.');
  }
  window.location.href = `tel:${digits}`;
}

export interface Coords {
  lat: number;
  lng: number;
}

export async function getCurrentCoords(): Promise<Coords> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('이 환경에서는 현재 위치를 쓸 수 없어요.'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => resolve({ lat: position.coords.latitude, lng: position.coords.longitude }),
      () => reject(new Error('위치 권한이 필요해요. 설정에서 허용해 주세요.')),
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 60_000 },
    );
  });
}

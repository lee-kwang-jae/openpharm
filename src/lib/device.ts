/**
 * 토스 SDK 기능은 토스앱 안에서만 동작한다.
 * 브라우저 프리뷰에서도 개발이 가능하도록 항상 웹 표준 API로 폴백한다.
 */
import { Accuracy, Clipboard, Device } from '@apps-in-toss/web-framework';

export async function copyText(text: string): Promise<void> {
  try {
    await Clipboard.setText(text);
    return;
  } catch {
    // 토스 브릿지를 못 쓰는 환경이면 웹 클립보드로 넘어간다.
  }
  await navigator.clipboard.writeText(text);
}

export async function openTel(tel: string): Promise<void> {
  const url = `tel:${tel.replace(/[^0-9+*#]/g, '')}`;
  try {
    await Device.openURL(url);
    return;
  } catch {
    window.location.href = url;
  }
}

export interface Coords {
  lat: number;
  lng: number;
}

export async function getCurrentCoords(): Promise<Coords> {
  try {
    const location = await Device.getLocation({ accuracy: Accuracy.Balanced });
    const coords = location?.coords;
    if (coords && Number.isFinite(coords.latitude) && Number.isFinite(coords.longitude)) {
      return { lat: coords.latitude, lng: coords.longitude };
    }
  } catch {
    // 권한 거부이거나 토스앱 밖이면 브라우저 위치 API로 시도한다.
  }

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

import { dutySlot } from './holidays';
import type { Place } from './types';

export type OpenState =
  | 'open' // 지금 영업 중
  | 'closing-soon' // 1시간 내 마감
  | 'before-open' // 오늘 열지만 아직 영업 전
  | 'after-close' // 오늘 열었지만 이미 마감
  | 'scheduled' // 오늘이 아닌 날짜라 시간만 안내
  | 'day-off' // 그날은 쉼
  | 'unknown'; // 공공데이터에 시간 정보가 없음

export interface OpenStatus {
  state: OpenState;
  /** "09:00 ~ 18:00" 또는 null */
  range: string | null;
  /** 화면에 그대로 쓰는 짧은 문구 */
  label: string;
  openMinutes: number | null;
  closeMinutes: number | null;
}

export function formatMinutes(value: number): string {
  const normalized = ((value % 1440) + 1440) % 1440;
  const hour = `${Math.floor(normalized / 60)}`.padStart(2, '0');
  const minute = `${normalized % 60}`.padStart(2, '0');
  return `${hour}:${minute}`;
}

function readSlot(hours: number[] | null, slot: number): [number, number] | null {
  if (!hours || hours.length < slot * 2) return null;
  const open = hours[(slot - 1) * 2];
  const close = hours[(slot - 1) * 2 + 1];
  if (open == null || close == null || open < 0 || close < 0) return null;
  return [open, close];
}

/**
 * 특정 날짜·시각 기준의 영업 상태.
 *
 * 공공데이터에 해당 요일 정보가 비어 있으면 "휴무"라고 단정하지 않고
 * '정보 없음'으로 둔다 — 잘못 닫혔다고 안내하면 아픈 사람이 헛걸음하게 된다.
 */
export function getOpenStatus(place: Place, target: Date, now = new Date()): OpenStatus {
  const slot = dutySlot(target);
  const found = readSlot(place.hours, slot);

  if (!found) {
    // 다른 요일에는 시간이 있는데 이 요일만 비어 있으면 휴무일 가능성이 높다.
    const hasOtherDays = Boolean(place.hours?.some((value, index) => index < 14 && value >= 0));
    return {
      state: hasOtherDays ? 'day-off' : 'unknown',
      range: null,
      label: hasOtherDays ? '휴무일 수 있음' : '운영시간 정보 없음',
      openMinutes: null,
      closeMinutes: null,
    };
  }

  const [open, close] = found;
  if (open === close) {
    return { state: 'day-off', range: null, label: '휴무', openMinutes: open, closeMinutes: close };
  }

  // 자정을 넘겨 닫는 곳(예: 09:00~26:00)은 종료 시각을 다음 날로 본다.
  const normalizedClose = close <= open ? close + 1440 : close;
  const range = `${formatMinutes(open)} ~ ${formatMinutes(close)}`;

  const isToday =
    target.getFullYear() === now.getFullYear() &&
    target.getMonth() === now.getMonth() &&
    target.getDate() === now.getDate();

  if (!isToday) {
    return { state: 'scheduled', range, label: range, openMinutes: open, closeMinutes: close };
  }

  const minutesNow = now.getHours() * 60 + now.getMinutes();
  if (minutesNow < open) {
    return { state: 'before-open', range, label: `${formatMinutes(open)} 영업 시작`, openMinutes: open, closeMinutes: close };
  }
  if (minutesNow >= normalizedClose) {
    return { state: 'after-close', range, label: '영업 종료', openMinutes: open, closeMinutes: close };
  }
  if (normalizedClose - minutesNow <= 60) {
    return {
      state: 'closing-soon',
      range,
      label: `${formatMinutes(close)} 마감`,
      openMinutes: open,
      closeMinutes: close,
    };
  }
  return { state: 'open', range, label: `${formatMinutes(close)}까지`, openMinutes: open, closeMinutes: close };
}

/** "문 여는 곳만" 필터가 통과시키는 상태. */
export function isOperating(state: OpenState): boolean {
  return state === 'open' || state === 'closing-soon' || state === 'before-open' || state === 'scheduled';
}

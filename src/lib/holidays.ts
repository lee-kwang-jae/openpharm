import holidayData from '../data/holidays.json';

const HOLIDAYS = holidayData.days as Record<string, string>;

export const HOLIDAY_SOURCE = holidayData.source;

const WEEKDAY_LABELS = ['일', '월', '화', '수', '목', '금', '토'] as const;

/** Date → "2026-09-25" (로컬 시간 기준) */
export function toDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function parseDateKey(key: string): Date {
  const [year, month, day] = key.split('-').map(Number);
  return new Date(year, month - 1, day);
}

export function holidayName(date: Date): string | null {
  return HOLIDAYS[toDateKey(date)] ?? null;
}

export function isHoliday(date: Date): boolean {
  return holidayName(date) != null;
}

export function weekdayLabel(date: Date): string {
  return WEEKDAY_LABELS[date.getDay()];
}

/**
 * dutyTime 배열에서 쓸 요일 슬롯을 고른다.
 * 1~7 = 월~일, 8 = 공휴일.
 */
export function dutySlot(date: Date): number {
  if (isHoliday(date)) return 8;
  const day = date.getDay();
  return day === 0 ? 7 : day;
}

export interface DayOption {
  key: string;
  date: Date;
  /** "오늘", "내일", "9/25" */
  label: string;
  /** "추석", "금요일" */
  caption: string;
  holiday: string | null;
  isWeekend: boolean;
}

function shiftDays(base: Date, days: number): Date {
  const next = new Date(base);
  next.setDate(next.getDate() + days);
  next.setHours(0, 0, 0, 0);
  return next;
}

/**
 * 날짜 선택 칩에 쓸 목록.
 * 오늘부터 2주치를 훑어서 오늘·내일 + 그 사이의 공휴일/주말을 추려낸다.
 * 연휴가 없으면 최소한 앞으로 5일은 고를 수 있게 채운다.
 */
export function upcomingDays(today = new Date(), lookaheadDays = 21): DayOption[] {
  const base = new Date(today);
  base.setHours(0, 0, 0, 0);

  const build = (date: Date, offset: number): DayOption => {
    const holiday = holidayName(date);
    const weekday = date.getDay();
    const label = offset === 0 ? '오늘' : offset === 1 ? '내일' : `${date.getMonth() + 1}/${date.getDate()}`;
    return {
      key: toDateKey(date),
      date,
      label,
      caption: holiday ?? `${weekdayLabel(date)}요일`,
      holiday,
      isWeekend: weekday === 0 || weekday === 6,
    };
  };

  const MAX = 9;
  const picked: DayOption[] = [build(base, 0), build(shiftDays(base, 1), 1)];
  const seen = new Set(picked.map((option) => option.key));

  const add = (offset: number) => {
    if (picked.length >= MAX) return;
    const option = build(shiftDays(base, offset), offset);
    if (seen.has(option.key)) return;
    picked.push(option);
    seen.add(option.key);
  };

  // 연휴가 이 앱의 존재 이유라, 주말보다 먼저 자리를 잡아준다.
  const stretch = nextHolidayStretch(base);
  if (stretch) {
    const from = Math.round((stretch.start.getTime() - base.getTime()) / 86_400_000);
    const to = Math.round((stretch.end.getTime() - base.getTime()) / 86_400_000);
    for (let offset = Math.max(from, 0); offset <= to; offset += 1) add(offset);
  }

  // 남는 자리는 가까운 주말·공휴일로 채운다.
  for (let offset = 2; offset <= lookaheadDays && picked.length < MAX; offset += 1) {
    const date = shiftDays(base, offset);
    if (holidayName(date) == null && date.getDay() !== 0 && date.getDay() !== 6) continue;
    add(offset);
  }

  // 공휴일도 주말도 한참 없으면 며칠이라도 고를 수 있게 채워준다.
  for (let offset = 2; picked.length < 5 && offset <= 6; offset += 1) add(offset);

  return picked.sort((a, b) => a.key.localeCompare(b.key));
}

/** 다가오는 연속 공휴일 묶음. 배너 문구("추석 연휴 D-21")에 쓴다. */
export function nextHolidayStretch(today = new Date()): { name: string; start: Date; end: Date } | null {
  const base = new Date(today);
  base.setHours(0, 0, 0, 0);

  for (let offset = 0; offset <= 120; offset += 1) {
    const date = shiftDays(base, offset);
    const name = holidayName(date);
    if (name == null) continue;

    let end = date;
    for (let extra = 1; extra <= 6; extra += 1) {
      const next = shiftDays(date, extra);
      // 연휴 사이에 낀 주말도 한 묶음으로 본다.
      const isRestDay = holidayName(next) != null || next.getDay() === 0 || next.getDay() === 6;
      if (!isRestDay) break;
      end = next;
    }
    return { name: name.replace(/\s*(연휴|대체공휴일)$/, ''), start: date, end };
  }
  return null;
}

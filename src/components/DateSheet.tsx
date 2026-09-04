import { adaptive } from '@toss/tds-colors';
import { useEffect, useMemo, useState } from 'react';

import { holidayName, parseDateKey, toDateKey, upcomingDays } from '../lib/holidays';

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];
/** 공공데이터에 운영시간만 들어있어서, 너무 먼 미래까지 고르게 할 이유가 없다. */
const MAX_MONTHS_AHEAD = 6;

interface Props {
  value: string;
  today: Date;
  onPick: (key: string) => void;
  onClose: () => void;
}

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function addMonths(date: Date, months: number) {
  return new Date(date.getFullYear(), date.getMonth() + months, 1);
}

export function DateSheet({ value, today, onPick, onClose }: Props) {
  const selected = useMemo(() => parseDateKey(value), [value]);
  const [month, setMonth] = useState(() => startOfMonth(selected));

  const todayKey = toDateKey(today);
  const firstMonth = startOfMonth(today);
  const lastMonth = addMonths(firstMonth, MAX_MONTHS_AHEAD);
  const canGoBack = month > firstMonth;
  const canGoForward = month < lastMonth;

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  const quickPicks = useMemo(() => upcomingDays(today), [today]);

  // 1일이 무슨 요일인지에 따라 앞을 빈칸으로 채운다.
  const cells: (Date | null)[] = [];
  for (let i = 0; i < month.getDay(); i += 1) cells.push(null);
  const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push(new Date(month.getFullYear(), month.getMonth(), day));
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 120 }}>
      <button
        type="button"
        aria-label="닫기"
        onClick={onClose}
        style={{ position: 'absolute', inset: 0, border: 'none', padding: 0, background: 'rgba(0,0,0,.45)', cursor: 'pointer' }}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="날짜 선택"
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          maxHeight: '86vh',
          overflowY: 'auto',
          background: adaptive.background,
          borderTopLeftRadius: 20,
          borderTopRightRadius: 20,
          padding: '20px 20px calc(20px + env(safe-area-inset-bottom, 0px))',
        }}
      >
        <h2 style={{ margin: '0 0 4px', fontSize: 19, color: adaptive.grey800 }}>날짜 선택</h2>
        <p style={{ margin: '0 0 16px', fontSize: 13, color: adaptive.grey500 }}>
          고른 날짜에 문 여는 곳만 찾아드려요.
        </p>

        <div style={{ display: 'flex', gap: 6, marginBottom: 18, overflowX: 'auto', scrollbarWidth: 'none' }}>
          {quickPicks.map((option) => {
            const isSelected = option.key === value;
            return (
              <button
                key={option.key}
                type="button"
                onClick={() => onPick(option.key)}
                style={{
                  flexShrink: 0,
                  padding: '8px 13px',
                  borderRadius: 999,
                  border: `1px solid ${isSelected ? 'transparent' : adaptive.grey200}`,
                  background: isSelected ? adaptive.blue500 : 'transparent',
                  color: isSelected ? '#FFFFFF' : option.holiday ? adaptive.red500 : adaptive.grey700,
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                {option.label}
                {option.holiday ? ` · ${option.holiday}` : ''}
              </button>
            );
          })}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <button
            type="button"
            aria-label="이전 달"
            disabled={!canGoBack}
            onClick={() => setMonth((current) => addMonths(current, -1))}
            style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              border: 'none',
              background: 'transparent',
              color: canGoBack ? adaptive.grey700 : adaptive.grey300,
              fontSize: 18,
              cursor: canGoBack ? 'pointer' : 'default',
            }}
          >
            ‹
          </button>
          <strong style={{ fontSize: 16, color: adaptive.grey800 }}>
            {month.getFullYear()}년 {month.getMonth() + 1}월
          </strong>
          <button
            type="button"
            aria-label="다음 달"
            disabled={!canGoForward}
            onClick={() => setMonth((current) => addMonths(current, 1))}
            style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              border: 'none',
              background: 'transparent',
              color: canGoForward ? adaptive.grey700 : adaptive.grey300,
              fontSize: 18,
              cursor: canGoForward ? 'pointer' : 'default',
            }}
          >
            ›
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', marginBottom: 4 }}>
          {WEEKDAYS.map((label, index) => (
            <span
              key={label}
              style={{
                textAlign: 'center',
                fontSize: 12,
                fontWeight: 600,
                color: index === 0 ? adaptive.red400 : index === 6 ? adaptive.blue400 : adaptive.grey500,
              }}
            >
              {label}
            </span>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2 }}>
          {cells.map((date, index) => {
            if (!date) return <span key={`blank-${index}`} />;
            const key = toDateKey(date);
            const holiday = holidayName(date);
            const isSelected = key === value;
            const isToday = key === todayKey;
            const isPast = key < todayKey;
            const weekday = date.getDay();

            const color = isSelected
              ? '#FFFFFF'
              : isPast
                ? adaptive.grey300
                : holiday || weekday === 0
                  ? adaptive.red500
                  : weekday === 6
                    ? adaptive.blue500
                    : adaptive.grey800;

            return (
              <button
                key={key}
                type="button"
                disabled={isPast}
                onClick={() => onPick(key)}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 1,
                  height: 46,
                  borderRadius: 10,
                  border: isToday && !isSelected ? `1px solid ${adaptive.blue300}` : '1px solid transparent',
                  background: isSelected ? adaptive.blue500 : 'transparent',
                  color,
                  fontSize: 15,
                  fontWeight: isSelected || isToday ? 700 : 500,
                  cursor: isPast ? 'default' : 'pointer',
                  padding: 0,
                }}
              >
                {date.getDate()}
                {holiday && !isPast ? (
                  <span
                    style={{
                      width: 4,
                      height: 4,
                      borderRadius: '50%',
                      background: isSelected ? '#FFFFFF' : adaptive.red500,
                    }}
                  />
                ) : null}
              </button>
            );
          })}
        </div>

        <p style={{ margin: '16px 0 0', fontSize: 12, color: adaptive.grey500 }}>
          <span style={{ display: 'inline-block', width: 4, height: 4, borderRadius: '50%', background: adaptive.red500, verticalAlign: 'middle', marginRight: 5 }} />
          점이 찍힌 날은 공휴일이에요.
        </p>
      </div>
    </div>
  );
}

import { adaptive } from '@toss/tds-colors';

interface Props {
  /** 사용자가 직접 고른 날짜인지. 안 골랐으면 오늘 기준으로 본다. */
  picked: boolean;
  date: Date;
  onClick: () => void;
}

function CalendarIcon({ color }: { color: string }) {
  return (
    <svg width="21" height="21" viewBox="0 0 21 21" fill="none" aria-hidden="true">
      <rect x="3" y="4.5" width="15" height="13" rx="3" stroke={color} strokeWidth="1.7" />
      <path d="M3 8.5h15" stroke={color} strokeWidth="1.7" />
      <path d="M7 2.5v3M14 2.5v3" stroke={color} strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

export function DateButton({ picked, date, onClick }: Props) {
  const color = picked ? '#FFFFFF' : adaptive.grey700;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="날짜 선택"
      style={{
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 1,
        width: 56,
        height: 56,
        borderRadius: 16,
        border: picked ? '1.5px solid transparent' : `1.5px solid ${adaptive.grey200}`,
        background: picked ? adaptive.blue500 : 'transparent',
        cursor: 'pointer',
        padding: 0,
      }}
    >
      <CalendarIcon color={color} />
      <span style={{ fontSize: 10, fontWeight: 700, lineHeight: '13px', color }}>
        {picked ? `${date.getMonth() + 1}/${date.getDate()}` : '오늘'}
      </span>
    </button>
  );
}

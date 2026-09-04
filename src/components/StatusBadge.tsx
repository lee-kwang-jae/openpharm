import { adaptive } from '@toss/tds-colors';

import type { OpenState } from '../lib/hours';

const STYLES: Record<OpenState, { text: string; bg: string; fg: string }> = {
  open: { text: '영업 중', bg: adaptive.green50, fg: adaptive.green600 },
  'closing-soon': { text: '곧 마감', bg: adaptive.orange50, fg: adaptive.orange600 },
  'before-open': { text: '영업 전', bg: adaptive.blue50, fg: adaptive.blue600 },
  'after-close': { text: '영업 종료', bg: adaptive.grey100, fg: adaptive.grey600 },
  scheduled: { text: '영업 예정', bg: adaptive.blue50, fg: adaptive.blue600 },
  'day-off': { text: '휴무', bg: adaptive.grey100, fg: adaptive.grey600 },
  unknown: { text: '정보 없음', bg: adaptive.grey100, fg: adaptive.grey500 },
};

export function StatusBadge({ state }: { state: OpenState }) {
  const style = STYLES[state];
  return (
    <span
      style={{
        flexShrink: 0,
        padding: '3px 8px',
        borderRadius: 6,
        background: style.bg,
        color: style.fg,
        fontSize: 12,
        fontWeight: 700,
        lineHeight: '16px',
      }}
    >
      {style.text}
    </span>
  );
}

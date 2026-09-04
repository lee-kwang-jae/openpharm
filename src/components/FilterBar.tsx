import { adaptive } from '@toss/tds-colors';

import type { PlaceCategory } from '../lib/types';

export type CategoryFilter = 'all' | PlaceCategory;

const CATEGORIES: { key: CategoryFilter; label: string }[] = [
  { key: 'all', label: '전체' },
  { key: 'pharmacy', label: '약국' },
  { key: 'clinic', label: '의원' },
  { key: 'hospital', label: '병원' },
  { key: 'dental', label: '치과' },
  { key: 'oriental', label: '한의원' },
];

interface Props {
  category: CategoryFilter;
  onCategoryChange: (value: CategoryFilter) => void;
  onlyOpen: boolean;
  onOnlyOpenChange: (value: boolean) => void;
  counts: Partial<Record<CategoryFilter, number>>;
}

function pill(selected: boolean) {
  return {
    flexShrink: 0,
    padding: '7px 13px',
    borderRadius: 999,
    border: `1px solid ${selected ? 'transparent' : adaptive.grey200}`,
    background: selected ? adaptive.grey800 : 'transparent',
    color: selected ? adaptive.background : adaptive.grey700,
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
    font: 'inherit',
  } as const;
}

export function FilterBar({ category, onCategoryChange, onlyOpen, onOnlyOpenChange, counts }: Props) {
  return (
    <div style={{ display: 'grid', gap: 8 }}>
      <div style={{ display: 'flex', gap: 6, padding: '0 20px', overflowX: 'auto', scrollbarWidth: 'none' }}>
        {CATEGORIES.map((item) => {
          const count = counts[item.key];
          if (item.key !== 'all' && count === 0) return null;
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => onCategoryChange(item.key)}
              style={{ ...pill(category === item.key), fontSize: 13, fontWeight: 600 }}
            >
              {item.label}
              {count != null ? ` ${count}` : ''}
            </button>
          );
        })}
      </div>

      <div style={{ padding: '0 20px' }}>
        <label
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            fontSize: 13,
            color: adaptive.grey700,
            cursor: 'pointer',
          }}
        >
          <input
            type="checkbox"
            checked={onlyOpen}
            onChange={(event) => onOnlyOpenChange(event.target.checked)}
            style={{ width: 16, height: 16, accentColor: adaptive.blue500 }}
          />
          이 날 문 여는 곳만 보기
        </label>
      </div>
    </div>
  );
}

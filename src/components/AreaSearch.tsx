import { adaptive } from '@toss/tds-colors';
import { useMemo, useRef, useState } from 'react';

import { REGION_INDEX, searchAreas } from '../lib/places';
import type { Area } from '../lib/types';

interface Props {
  onPick: (area: Area) => void;
  onUseCurrentLocation: () => void;
  locating: boolean;
  /** 서비스 지역 문구. 예: "하남시 · 송파구" */
  coverage?: string;
  /** 검색창 오른쪽에 붙는 날짜 버튼 */
  trailing?: React.ReactNode;
  placeholder?: string;
}

function SearchIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <circle cx="9" cy="9" r="6" stroke={adaptive.grey500} strokeWidth="1.8" />
      <path d="M13.5 13.5 17 17" stroke={adaptive.grey500} strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

export function AreaSearch({ onPick, onUseCurrentLocation, locating, coverage, trailing, placeholder }: Props) {
  const [query, setQuery] = useState('');
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const results = useMemo(() => searchAreas(query.trim()), [query]);
  const showResults = focused && query.trim().length > 0;
  // 서비스 지역이 한 곳이면 그 동네 이름을 예시로 보여주는 게 가장 안내가 잘 된다.
  const sampleDong = REGION_INDEX.dong[0]?.n ?? '역삼동';

  const pick = (area: Area) => {
    setQuery('');
    setFocused(false);
    inputRef.current?.blur();
    onPick(area);
  };

  return (
    <div style={{ position: 'relative', padding: '0 20px' }}>
      <div style={{ display: 'flex', alignItems: 'stretch', gap: 8 }}>
        <div
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            minWidth: 0,
            height: 56,
            padding: '0 16px',
            borderRadius: 16,
            background: adaptive.greyBackground,
            border: `1.5px solid ${focused ? adaptive.blue500 : 'transparent'}`,
            transition: 'border-color .15s',
          }}
        >
          <SearchIcon />
          <input
            ref={inputRef}
            value={query}
            type="text"
            inputMode="text"
            placeholder={placeholder ?? `동 이름 검색 (예: ${sampleDong})`}
            onChange={(event) => setQuery(event.target.value)}
            onFocus={() => setFocused(true)}
            // 목록 항목을 누르는 순간 blur 되어 목록이 사라지지 않게 살짝 늦춘다.
            onBlur={() => window.setTimeout(() => setFocused(false), 150)}
            style={{
              flex: 1,
              minWidth: 0,
              border: 'none',
              outline: 'none',
              background: 'transparent',
              color: adaptive.grey800,
              fontSize: 17,
              fontWeight: 500,
              padding: 0,
            }}
          />
          {query ? (
            <button
              type="button"
              aria-label="지우기"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => {
                setQuery('');
                inputRef.current?.focus();
              }}
              style={{
                flexShrink: 0,
                width: 22,
                height: 22,
                borderRadius: '50%',
                border: 'none',
                background: adaptive.grey300,
                color: '#FFFFFF',
                fontSize: 13,
                lineHeight: '22px',
                padding: 0,
                cursor: 'pointer',
              }}
            >
              ×
            </button>
          ) : null}
        </div>

        {trailing}
      </div>

      <button
        type="button"
        onClick={onUseCurrentLocation}
        disabled={locating}
        style={{
          marginTop: 10,
          padding: '7px 12px',
          borderRadius: 999,
          border: `1px solid ${adaptive.grey200}`,
          background: 'transparent',
          color: adaptive.grey700,
          fontSize: 13,
          fontWeight: 600,
          cursor: locating ? 'default' : 'pointer',
        }}
      >
        {locating ? '위치 확인 중…' : '📍 현재 위치로 찾기'}
      </button>

      {showResults ? (
        <div
          style={{
            position: 'absolute',
            top: 62,
            left: 20,
            right: 20,
            zIndex: 30,
            maxHeight: 280,
            overflowY: 'auto',
            background: adaptive.background,
            border: `1px solid ${adaptive.grey200}`,
            borderRadius: 14,
            boxShadow: '0 8px 24px rgba(0,0,0,.12)',
          }}
        >
          {results.length === 0 ? (
            <p style={{ margin: 0, padding: '16px 14px', fontSize: 14, color: adaptive.grey500 }}>
              {coverage
                ? `검색 결과가 없어요. 지금은 ${coverage} 정보만 담고 있어요.`
                : '검색 결과가 없어요. 동·읍·면 이름이나 시군구 이름으로 찾아보세요.'}
            </p>
          ) : (
            results.map((area) => (
              <button
                key={`${area.kind}-${area.sigunguIndex}-${area.label}`}
                type="button"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => pick(area)}
                style={{
                  display: 'block',
                  width: '100%',
                  textAlign: 'left',
                  padding: '13px 16px',
                  border: 'none',
                  borderBottom: `1px solid ${adaptive.hairlineBorder}`,
                  background: 'transparent',
                  cursor: 'pointer',
                  font: 'inherit',
                }}
              >
                <span style={{ fontSize: 16, fontWeight: 600, color: adaptive.grey800 }}>{area.label}</span>
                <span style={{ marginLeft: 8, fontSize: 13, color: adaptive.grey500 }}>{area.parent}</span>
              </button>
            ))
          )}
        </div>
      ) : null}
    </div>
  );
}

import { adaptive } from '@toss/tds-colors';
import { useEffect } from 'react';

import { dutySlot, toDateKey, weekdayLabel } from '../lib/holidays';
import { formatMinutes, getOpenStatus } from '../lib/hours';
import { formatDistance } from '../lib/places';
import type { Place } from '../lib/types';
import { StatusBadge } from './StatusBadge';

const DAY_LABELS = ['월', '화', '수', '목', '금', '토', '일', '공휴일'];

interface Props {
  place: Place;
  targetDate: Date;
  now: Date;
  /** 거리를 잰 기준점 이름 (선택한 동 또는 시군구). */
  originLabel: string;
  onClose: () => void;
  onCall: (place: Place) => void;
  onCopyAddress: (place: Place) => void;
}

function WeeklyHours({ place, highlight }: { place: Place; highlight: number }) {
  if (!place.hours) {
    return (
      <p style={{ margin: 0, fontSize: 14, color: adaptive.grey500 }}>
        공공데이터에 운영시간이 등록되어 있지 않아요. 방문 전 전화로 확인해 주세요.
      </p>
    );
  }

  return (
    <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 6 }}>
      {DAY_LABELS.map((label, index) => {
        const open = place.hours![index * 2];
        const close = place.hours![index * 2 + 1];
        const isHighlighted = index + 1 === highlight;
        const text =
          open >= 0 && close >= 0 ? (open === close ? '휴무' : `${formatMinutes(open)} ~ ${formatMinutes(close)}`) : '정보 없음';
        return (
          <li
            key={label}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              fontSize: 14,
              lineHeight: '20px',
              fontWeight: isHighlighted ? 700 : 400,
              color: isHighlighted ? adaptive.grey800 : adaptive.grey600,
            }}
          >
            <span>{label}</span>
            <span>{text}</span>
          </li>
        );
      })}
    </ul>
  );
}

export function PlaceDetail({ place, targetDate, now, originLabel, onClose, onCall, onCopyAddress }: Props) {
  const status = getOpenStatus(place, targetDate, now);
  const highlight = dutySlot(targetDate);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 100 }}>
      <button
        type="button"
        aria-label="닫기"
        onClick={onClose}
        style={{
          position: 'absolute',
          inset: 0,
          border: 'none',
          padding: 0,
          background: 'rgba(0,0,0,.45)',
          cursor: 'pointer',
        }}
      />
      <div
        role="dialog"
        aria-modal="true"
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          maxHeight: '82vh',
          overflowY: 'auto',
          background: adaptive.background,
          borderTopLeftRadius: 20,
          borderTopRightRadius: 20,
          padding: '20px 20px calc(20px + env(safe-area-inset-bottom, 0px))',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: adaptive.grey600 }}>{place.kind}</span>
          <StatusBadge state={status.state} />
        </div>

        <h2 style={{ margin: '0 0 4px', fontSize: 21, lineHeight: '28px', color: adaptive.grey800 }}>{place.name}</h2>

        <p style={{ margin: '0 0 2px', fontSize: 14, color: adaptive.grey600, lineHeight: '20px' }}>{place.address}</p>
        {place.distanceKm != null ? (
          <p style={{ margin: 0, fontSize: 13, color: adaptive.grey500 }}>
            {originLabel} 중심에서 약 {formatDistance(place.distanceKm)}
          </p>
        ) : null}

        <div style={{ display: 'flex', gap: 8, margin: '16px 0 20px' }}>
          <button
            type="button"
            disabled={!place.tel}
            onClick={() => onCall(place)}
            style={{
              flex: 1,
              padding: '13px 0',
              borderRadius: 12,
              border: 'none',
              background: place.tel ? adaptive.blue500 : adaptive.grey100,
              color: place.tel ? '#FFFFFF' : adaptive.grey400,
              fontSize: 15,
              fontWeight: 700,
              cursor: place.tel ? 'pointer' : 'default',
            }}
          >
            {place.tel ? '전화하기' : '전화번호 없음'}
          </button>
          <button
            type="button"
            onClick={() => onCopyAddress(place)}
            style={{
              flex: 1,
              padding: '13px 0',
              borderRadius: 12,
              border: 'none',
              background: adaptive.grey100,
              color: adaptive.grey700,
              fontSize: 15,
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            주소 복사
          </button>
        </div>

        <h3 style={{ margin: '0 0 10px', fontSize: 15, color: adaptive.grey700 }}>
          운영시간
          <span style={{ marginLeft: 6, fontSize: 13, fontWeight: 400, color: adaptive.grey500 }}>
            {toDateKey(targetDate)} ({weekdayLabel(targetDate)}) 기준
          </span>
        </h3>
        <WeeklyHours place={place} highlight={highlight} />

        {place.note ? (
          <p
            style={{
              margin: '16px 0 0',
              padding: 12,
              borderRadius: 10,
              background: adaptive.greyBackground,
              fontSize: 13,
              lineHeight: '19px',
              color: adaptive.grey600,
            }}
          >
            {place.note}
          </p>
        ) : null}

        <p style={{ margin: '16px 0 0', fontSize: 12, lineHeight: '17px', color: adaptive.grey500 }}>
          운영시간은 기관이 등록한 값이라 실제와 다를 수 있어요. 방문 전에 전화로 한 번 확인해 주세요.
        </p>
      </div>
    </div>
  );
}

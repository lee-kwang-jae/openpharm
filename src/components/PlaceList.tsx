import { adaptive } from '@toss/tds-colors';

import { getOpenStatus } from '../lib/hours';
import { formatDistance } from '../lib/places';
import type { Place } from '../lib/types';
import { StatusBadge } from './StatusBadge';

interface Props {
  places: Place[];
  targetDate: Date;
  now: Date;
  selectedId: string | null;
  onSelect: (place: Place) => void;
}

const KIND_COLOR: Record<string, string> = {
  pharmacy: '#00A05B',
  clinic: '#3182F6',
  hospital: '#3182F6',
  dental: '#8E6BF0',
  oriental: '#E5883B',
  etc: '#6B7684',
};

export function PlaceList({ places, targetDate, now, selectedId, onSelect }: Props) {
  return (
    <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
      {places.map((place) => {
        const status = getOpenStatus(place, targetDate, now);
        const selected = place.id === selectedId;
        return (
          <li key={place.id}>
            <button
              type="button"
              onClick={() => onSelect(place)}
              style={{
                display: 'block',
                width: '100%',
                border: 'none',
                textAlign: 'left',
                padding: '14px 20px',
                background: selected ? adaptive.blue50 : 'transparent',
                borderBottom: `1px solid ${adaptive.hairlineBorder}`,
                cursor: 'pointer',
                appearance: 'none',
                font: 'inherit',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                <span
                  style={{
                    flexShrink: 0,
                    color: KIND_COLOR[place.category] ?? KIND_COLOR.etc,
                    fontSize: 12,
                    fontWeight: 700,
                  }}
                >
                  {place.kind}
                </span>
                {place.hasEmergencyRoom ? (
                  <span style={{ flexShrink: 0, color: adaptive.red500, fontSize: 12, fontWeight: 700 }}>응급실</span>
                ) : null}
                <span style={{ marginLeft: 'auto' }}>
                  <StatusBadge state={status.state} />
                </span>
              </div>

              <div
                style={{
                  fontSize: 16,
                  fontWeight: 700,
                  color: adaptive.grey800,
                  lineHeight: '22px',
                  wordBreak: 'keep-all',
                }}
              >
                {place.name}
              </div>

              <div style={{ marginTop: 3, fontSize: 13, color: adaptive.grey600, lineHeight: '18px' }}>
                {status.range ?? status.label}
                {place.distanceKm != null ? ` · ${formatDistance(place.distanceKm)}` : ''}
              </div>

              <div
                style={{
                  marginTop: 2,
                  fontSize: 13,
                  color: adaptive.grey500,
                  lineHeight: '18px',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {place.address}
              </div>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

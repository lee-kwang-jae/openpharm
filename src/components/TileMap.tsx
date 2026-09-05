import { adaptive } from '@toss/tds-colors';
import { useCallback, useEffect, useRef, useState } from 'react';

import type { Place } from '../lib/types';

/**
 * 키 없이 뜨는 대체 지도.
 *
 * 카카오맵 JS 키는 등록된 도메인에서만 동작해서, 키가 없거나 도메인 등록 전에는
 * 지도 자리가 통째로 비어버린다. 그때도 위치 감각은 줄 수 있도록
 * OSM 래스터 타일을 직접 붙여서 최소한의 팬/줌만 지원한다.
 * 카카오맵이 뜨면 이 컴포넌트는 쓰이지 않는다.
 */

const TILE_SIZE = 256;
const MIN_ZOOM = 11;
const MAX_ZOOM = 18;
const PHARMACY_COLOR = '#00A05B';
const CLINIC_COLOR = '#3182F6';
const MAX_MARKERS = 80;
/** 화면에 이 개수를 넘게 잡히면 이름표 대신 점으로 찍는다. */
const LABEL_LIMIT = 12;

interface LatLng {
  lat: number;
  lng: number;
}

function project({ lat, lng }: LatLng, zoom: number) {
  const scale = TILE_SIZE * 2 ** zoom;
  const sin = Math.sin((lat * Math.PI) / 180);
  return {
    x: ((lng + 180) / 360) * scale,
    y: (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * scale,
  };
}

function unproject(x: number, y: number, zoom: number): LatLng {
  const scale = TILE_SIZE * 2 ** zoom;
  const n = Math.PI - (2 * Math.PI * y) / scale;
  return {
    lng: (x / scale) * 360 - 180,
    lat: (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n))),
  };
}

interface Props {
  center: LatLng;
  places: Place[];
  selectedId: string | null;
  onSelect: (place: Place) => void;
  height: number;
  /** 처음 잡을 축척. 동은 크게, 시군구는 넓게 본다. */
  initialZoom?: number;
  /** 지도 위에 띄울 안내 문구 (카카오맵 실패 사유 등) */
  notice?: string;
  /** 주면 안내 문구 옆에 카카오맵 재시도 버튼이 붙는다. */
  onRetry?: () => void;
}

export function TileMap({
  center,
  places,
  selectedId,
  onSelect,
  height,
  initialZoom = 14,
  notice,
  onRetry,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 375, height });
  const [view, setView] = useState<LatLng>(center);
  const [zoom, setZoom] = useState(initialZoom);
  const dragRef = useRef<{ x: number; y: number; moved: boolean } | null>(null);

  // 지역을 새로 고르면 그쪽으로 옮겨가고, 축척도 그 단위에 맞춘다.
  useEffect(() => {
    setView(center);
    setZoom(initialZoom);
  }, [center.lat, center.lng, initialZoom]);

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => {
      setSize({ width: entry.contentRect.width, height: entry.contentRect.height });
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const origin = project(view, zoom);
  const left = origin.x - size.width / 2;
  const top = origin.y - size.height / 2;

  const worldTiles = 2 ** zoom;
  const firstX = Math.floor(left / TILE_SIZE);
  const lastX = Math.floor((left + size.width) / TILE_SIZE);
  const firstY = Math.max(0, Math.floor(top / TILE_SIZE));
  const lastY = Math.min(worldTiles - 1, Math.floor((top + size.height) / TILE_SIZE));

  const tiles: { key: string; url: string; x: number; y: number }[] = [];
  for (let tx = firstX; tx <= lastX; tx += 1) {
    for (let ty = firstY; ty <= lastY; ty += 1) {
      // 경도는 지구를 한 바퀴 돌 수 있어서 타일 번호를 감아준다.
      const wrapped = ((tx % worldTiles) + worldTiles) % worldTiles;
      tiles.push({
        key: `${zoom}/${tx}/${ty}`,
        url: `https://tile.openstreetmap.org/${zoom}/${wrapped}/${ty}.png`,
        x: tx * TILE_SIZE - left,
        y: ty * TILE_SIZE - top,
      });
    }
  }

  const onPointerDown = useCallback((event: React.PointerEvent) => {
    dragRef.current = { x: event.clientX, y: event.clientY, moved: false };
    event.currentTarget.setPointerCapture(event.pointerId);
  }, []);

  const onPointerMove = useCallback(
    (event: React.PointerEvent) => {
      const drag = dragRef.current;
      if (!drag) return;
      const dx = event.clientX - drag.x;
      const dy = event.clientY - drag.y;
      if (Math.abs(dx) + Math.abs(dy) < 3) return;
      drag.moved = true;
      drag.x = event.clientX;
      drag.y = event.clientY;
      setView((current) => {
        const point = project(current, zoom);
        return unproject(point.x - dx, point.y - dy, zoom);
      });
    },
    [zoom],
  );

  const onPointerUp = useCallback(() => {
    dragRef.current = null;
  }, []);

  const changeZoom = (delta: number) => {
    setZoom((current) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, current + delta)));
  };

  const onScreen = places
    .slice(0, MAX_MARKERS)
    .map((place) => {
      const point = project(place, zoom);
      return { place, x: point.x - left, y: point.y - top };
    })
    .filter(({ x, y }) => x > -60 && y > -40 && x < size.width + 60 && y < size.height + 40);

  const crowded = onScreen.length > LABEL_LIMIT;

  return (
    <div
      ref={containerRef}
      style={{
        position: 'relative',
        width: '100%',
        height,
        overflow: 'hidden',
        background: adaptive.greyBackground,
        touchAction: 'none',
        cursor: 'grab',
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      {tiles.map((tile) => (
        <img
          key={tile.key}
          src={tile.url}
          alt=""
          draggable={false}
          style={{
            position: 'absolute',
            left: tile.x,
            top: tile.y,
            width: TILE_SIZE,
            height: TILE_SIZE,
            userSelect: 'none',
            pointerEvents: 'none',
          }}
        />
      ))}

      {onScreen.map(({ place, x, y }) => {
        const selected = place.id === selectedId;
        const color = place.isPharmacy ? PHARMACY_COLOR : CLINIC_COLOR;
        // 이름표가 많으면 서로 겹쳐서 못 읽는다. 빽빽할 땐 점만 찍고
        // 고른 곳 하나에만 이름을 붙인다.
        const asDot = crowded && !selected;

        if (asDot) {
          return (
            <button
              key={place.id}
              type="button"
              aria-label={place.name}
              onClick={() => {
                if (dragRef.current?.moved) return;
                onSelect(place);
              }}
              style={{
                position: 'absolute',
                left: x,
                top: y,
                transform: 'translate(-50%, -50%)',
                width: 13,
                height: 13,
                padding: 0,
                borderRadius: '50%',
                border: '2px solid #FFFFFF',
                background: color,
                boxShadow: '0 1px 3px rgba(0,0,0,.35)',
                cursor: 'pointer',
              }}
            />
          );
        }

        return (
          <button
            key={place.id}
            type="button"
            onClick={() => {
              // 드래그로 끝난 포인터 조작은 클릭으로 치지 않는다.
              if (dragRef.current?.moved) return;
              onSelect(place);
            }}
            style={{
              position: 'absolute',
              left: x,
              top: y,
              transform: 'translate(-50%, -100%)',
              zIndex: selected ? 10 : 1,
              padding: '3px 7px',
              maxWidth: 110,
              borderRadius: 11,
              border: `1.5px solid ${color}`,
              background: selected ? color : '#FFFFFF',
              color: selected ? '#FFFFFF' : '#222429',
              fontSize: 11,
              fontWeight: 700,
              lineHeight: '14px',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              boxShadow: '0 2px 6px rgba(0,0,0,.18)',
              cursor: 'pointer',
            }}
          >
            {place.name.length > 9 ? `${place.name.slice(0, 8)}…` : place.name}
          </button>
        );
      })}

      <div style={{ position: 'absolute', right: 10, top: 10, display: 'grid', gap: 6, zIndex: 20 }}>
        {[
          { label: '+', delta: 1, disabled: zoom >= MAX_ZOOM },
          { label: '−', delta: -1, disabled: zoom <= MIN_ZOOM },
        ].map((button) => (
          <button
            key={button.label}
            type="button"
            aria-label={button.delta > 0 ? '확대' : '축소'}
            disabled={button.disabled}
            onClick={() => changeZoom(button.delta)}
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              border: `1px solid ${adaptive.grey200}`,
              background: '#FFFFFF',
              color: button.disabled ? adaptive.grey300 : adaptive.grey700,
              fontSize: 17,
              fontWeight: 700,
              lineHeight: '1',
              cursor: button.disabled ? 'default' : 'pointer',
            }}
          >
            {button.label}
          </button>
        ))}
      </div>

      {notice ? (
        <div
          style={{
            position: 'absolute',
            left: 10,
            top: 10,
            zIndex: 20,
            maxWidth: 'calc(100% - 70px)',
            padding: '6px 10px',
            borderRadius: 8,
            background: 'rgba(255,255,255,.92)',
            color: adaptive.grey600,
            fontSize: 11,
            lineHeight: '15px',
          }}
        >
          {notice}
          {onRetry ? (
            <button
              type="button"
              onClick={onRetry}
              style={{
                marginLeft: 6,
                padding: 0,
                border: 'none',
                background: 'none',
                color: adaptive.blue500,
                fontSize: 11,
                fontWeight: 700,
                lineHeight: '15px',
                cursor: 'pointer',
              }}
            >
              다시 시도
            </button>
          ) : null}
        </div>
      ) : null}

      <span
        style={{
          position: 'absolute',
          right: 4,
          bottom: 2,
          zIndex: 20,
          padding: '1px 4px',
          borderRadius: 3,
          background: 'rgba(255,255,255,.8)',
          color: adaptive.grey600,
          fontSize: 10,
        }}
      >
        © OpenStreetMap contributors
      </span>
    </div>
  );
}

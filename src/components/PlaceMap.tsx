/* eslint-disable @typescript-eslint/no-explicit-any */
import { adaptive } from '@toss/tds-colors';
import { useEffect, useRef, useState } from 'react';

import { loadKakaoMaps } from '../lib/kakao';
import type { Place } from '../lib/types';
import { TileMap } from './TileMap';

const PHARMACY_COLOR = '#00A05B';
const CLINIC_COLOR = '#3182F6';
const MAX_MARKERS = 80;

interface Props {
  center: { lat: number; lng: number };
  places: Place[];
  selectedId: string | null;
  onSelect: (place: Place) => void;
  height: number;
  /** 카카오맵 level. 숫자가 작을수록 확대된다. */
  level?: number;
}

function escapeHtml(text: string) {
  return text.replace(/[&<>"']/g, (char) => {
    switch (char) {
      case '&':
        return '&amp;';
      case '<':
        return '&lt;';
      case '>':
        return '&gt;';
      case '"':
        return '&quot;';
      default:
        return '&#39;';
    }
  });
}

function markerHtml(place: Place, selected: boolean) {
  const color = place.isPharmacy ? PHARMACY_COLOR : CLINIC_COLOR;
  const scale = selected ? 1.15 : 1;
  const trimmed = place.name.length > 9 ? `${place.name.slice(0, 8)}…` : place.name;
  const label = escapeHtml(trimmed);
  // 좌우/상하 정렬은 CustomOverlay 의 xAnchor(기본 0.5)·yAnchor 가 맡는다.
  // 여기서 translate 까지 걸면 이름표가 한 칸씩 밀린다.
  return `
    <div style="transform:scale(${scale});transform-origin:bottom center;cursor:pointer;text-align:center;">
      <div style="
        display:inline-block;max-width:120px;padding:3px 8px;border-radius:12px;
        background:${selected ? color : '#FFFFFF'};color:${selected ? '#FFFFFF' : '#222429'};
        font-size:11px;font-weight:700;line-height:15px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;
        border:1.5px solid ${color};box-shadow:0 2px 6px rgba(0,0,0,.18);
      ">${label}</div>
      <div style="width:2px;height:8px;margin:0 auto;background:${color};"></div>
    </div>`;
}

export function PlaceMap({ center, places, selectedId, onSelect, height, level = 5 }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const overlaysRef = useRef<any[]>([]);
  const onSelectRef = useRef(onSelect);
  const [error, setError] = useState<string | null>(null);
  // 카카오 콘솔 설정을 고친 뒤 앱을 다시 켜지 않고도 지도를 붙여볼 수 있게 한다.
  const [attempt, setAttempt] = useState(0);

  onSelectRef.current = onSelect;

  // 지도 인스턴스는 한 번만 만들고 이후에는 중심만 옮긴다.
  useEffect(() => {
    let cancelled = false;

    loadKakaoMaps()
      .then((maps) => {
        if (cancelled || !containerRef.current) return;
        mapRef.current = new maps.Map(containerRef.current, {
          center: new maps.LatLng(center.lat, center.lng),
          level,
        });
        setError(null);
      })
      .catch((cause: Error) => {
        if (!cancelled) setError(cause.message);
      });

    return () => {
      cancelled = true;
    };
    // center 는 아래 effect 에서 따로 반영한다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt]);

  useEffect(() => {
    const maps = window.kakao?.maps;
    if (!maps || !mapRef.current) return;
    mapRef.current.setCenter(new maps.LatLng(center.lat, center.lng));
  }, [center.lat, center.lng]);

  useEffect(() => {
    const maps = window.kakao?.maps;
    const map = mapRef.current;
    if (!maps || !map) return;

    for (const overlay of overlaysRef.current) overlay.setMap(null);
    overlaysRef.current = [];

    const visible = places.slice(0, MAX_MARKERS);
    for (const place of visible) {
      const selected = place.id === selectedId;
      const element = document.createElement('div');
      element.innerHTML = markerHtml(place, selected);
      element.addEventListener('click', () => onSelectRef.current(place));

      const overlay = new maps.CustomOverlay({
        position: new maps.LatLng(place.lat, place.lng),
        content: element,
        yAnchor: 1,
        zIndex: selected ? 10 : 1,
      });
      overlay.setMap(map);
      overlaysRef.current.push(overlay);
    }

    return () => {
      for (const overlay of overlaysRef.current) overlay.setMap(null);
      overlaysRef.current = [];
    };
  }, [places, selectedId]);

  // 목록에서 고른 곳이 화면 밖이면 지도를 그쪽으로 옮긴다.
  useEffect(() => {
    const maps = window.kakao?.maps;
    const map = mapRef.current;
    if (!maps || !map || !selectedId) return;
    const place = places.find((item) => item.id === selectedId);
    if (!place) return;
    const position = new maps.LatLng(place.lat, place.lng);
    if (!map.getBounds().contain(position)) map.panTo(position);
  }, [selectedId, places]);

  // 카카오맵이 안 뜨면 지도 자리를 비워두지 않고 키 없이 뜨는 지도로 대체한다.
  if (error) {
    return (
      <TileMap
        center={center}
        places={places}
        selectedId={selectedId}
        onSelect={onSelect}
        height={height}
        initialZoom={18 - level}
        notice={
          import.meta.env.DEV
            ? '카카오맵 미연결 — npm run check:kakao 로 사유를 확인하세요. 지금은 기본 지도예요.'
            : '기본 지도로 보여주고 있어요.'
        }
        onRetry={() => {
          setError(null);
          setAttempt((count) => count + 1);
        }}
      />
    );
  }

  return <div ref={containerRef} style={{ width: '100%', height, background: adaptive.greyBackground }} />;
}

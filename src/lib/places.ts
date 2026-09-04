import regionData from '../data/regions.json';
import {
  FLAG_DONG_INFERRED,
  FLAG_EMERGENCY,
  FLAG_PHARMACY,
  type Area,
  type DongEntry,
  type Place,
  type PlaceCategory,
  type PlaceChunk,
  type SigunguSummary,
  type RegionIndex,
} from './types';

export const REGION_INDEX = regionData as RegionIndex;

export const DATA_SOURCE = REGION_INDEX.source;
export const DATA_GENERATED_AT = REGION_INDEX.generatedAt;
export const HAS_DATA = REGION_INDEX.sigungu.length > 0;
/** 이 앱이 다루는 지역 전체 표기. 예: "경기도 하남시, 서울특별시 송파구" */
export const COVERAGE = REGION_INDEX.coverage ?? '';

/** 화면 안내용 짧은 표기. 예: "하남시 · 송파구" */
export const COVERAGE_SHORT = COVERAGE
  ? COVERAGE.split(',')
      .map((entry) => entry.trim().split(/\s+/).slice(1).join(' '))
      .filter(Boolean)
      .join(' · ')
  : '';

const placeFiles = import.meta.glob<{ default: PlaceChunk }>('../data/places/*.json');

function fileKey(index: number) {
  return `../data/places/${index}.json`;
}

const cache = new Map<number, Place[]>();

function categorize(kind: string, isPharmacy: boolean): PlaceCategory {
  if (isPharmacy) return 'pharmacy';
  if (kind.includes('치과')) return 'dental';
  if (kind.includes('한방') || kind.includes('한의')) return 'oriental';
  if (kind.includes('의원')) return 'clinic';
  if (kind.includes('병원')) return 'hospital';
  return 'etc';
}

function expandChunk(chunk: PlaceChunk, sigunguIndex: number): Place[] {
  return chunk.r.map((row, rowIndex) => {
    const [name, address, tel, lat, lng, dongIdx, kindIdx, flags, hoursIdx, note] = row;
    const kind = chunk.k[kindIdx] ?? '의료기관';
    const isPharmacy = (flags & FLAG_PHARMACY) !== 0;
    return {
      id: `${sigunguIndex}:${rowIndex}`,
      name,
      // 주소는 시군구 접두사를 떼서 저장하므로 화면에 쓸 때 다시 붙인다.
      address: `${chunk.p} ${address}`,
      tel: tel || null,
      lat,
      lng,
      dong: chunk.d[dongIdx] ?? null,
      kind,
      category: categorize(kind, isPharmacy),
      isPharmacy,
      hasEmergencyRoom: (flags & FLAG_EMERGENCY) !== 0,
      note: note || null,
      hours: chunk.h[hoursIdx] ?? null,
      dongInferred: (flags & FLAG_DONG_INFERRED) !== 0,
      distanceKm: null,
    };
  });
}

/** 시군구 하나 분량의 시설 목록을 필요한 순간에만 불러온다. */
export async function loadSigungu(index: number): Promise<Place[]> {
  const cached = cache.get(index);
  if (cached) return cached;

  const loader = placeFiles[fileKey(index)];
  if (!loader) return [];

  const mod = await loader();
  const places = expandChunk(mod.default, index);
  cache.set(index, places);
  return places;
}

export function distanceKm(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const R = 6371;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.sin(dLng / 2) ** 2 * Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat));
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function formatDistance(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)}m`;
  return `${km.toFixed(1)}km`;
}

function sigunguLabel(index: number): string {
  const entry = REGION_INDEX.sigungu[index];
  if (!entry) return '';
  return entry.sido === entry.name ? entry.sido : `${entry.sido} ${entry.name}`;
}

export function toArea(dong: DongEntry): Area {
  return {
    kind: 'dong',
    label: dong.n,
    parent: sigunguLabel(dong.s),
    sigunguIndex: dong.s,
    lat: dong.y,
    lng: dong.x,
  };
}

const HANGUL_ONLY = /[^가-힣0-9a-zA-Z]/g;

function normalize(text: string): string {
  return text.replace(HANGUL_ONLY, '');
}

/**
 * 동 이름 자동완성.
 * 앞글자가 맞는 결과를 먼저 보여주고, 그 다음 부분 일치를 붙인다.
 */
export function searchAreas(query: string, limit = 25): Area[] {
  const q = normalize(query);
  if (q.length === 0) return [];

  const prefix: Area[] = [];
  const partial: Area[] = [];

  for (const dong of REGION_INDEX.dong) {
    const name = normalize(dong.n);
    if (name.startsWith(q)) {
      prefix.push(toArea(dong));
    } else if (name.includes(q)) {
      partial.push(toArea(dong));
    }
    if (prefix.length >= limit) break;
  }

  // 동 이름이 안 걸리면 시군구 이름으로도 찾아본다 ("강남구", "성남시").
  const byRegion: Area[] = [];
  if (prefix.length + partial.length < limit) {
    for (const entry of REGION_INDEX.sigungu) {
      const label = normalize(`${entry.sido}${entry.name}`);
      if (!label.includes(q)) continue;
      const dongs = REGION_INDEX.dong.filter((dong) => dong.s === entry.i);
      if (dongs.length === 0) continue;
      byRegion.push({
        kind: 'sigungu',
        label: entry.name,
        parent: entry.sido,
        sigunguIndex: entry.i,
        lat: dongs.reduce((sum, dong) => sum + dong.y, 0) / dongs.length,
        lng: dongs.reduce((sum, dong) => sum + dong.x, 0) / dongs.length,
      });
    }
  }

  return [...prefix, ...partial, ...byRegion].slice(0, limit);
}

function sigunguArea(entry: SigunguSummary): Area | null {
  const dongs = REGION_INDEX.dong.filter((dong) => dong.s === entry.i);
  if (dongs.length === 0) return null;

  // 동 중심을 그냥 평균 내면 시설이 거의 없는 산·논밭 쪽으로 중심이 끌려간다.
  // 시설 수로 가중치를 줘서 사람이 실제로 찾아갈 곳 근처를 보게 한다.
  const weight = dongs.reduce((sum, dong) => sum + (dong.c ?? 1), 0);
  return {
    kind: 'sigungu',
    label: entry.name,
    parent: entry.sido,
    sigunguIndex: entry.i,
    lat: dongs.reduce((sum, dong) => sum + dong.y * (dong.c ?? 1), 0) / weight,
    lng: dongs.reduce((sum, dong) => sum + dong.x * (dong.c ?? 1), 0) / weight,
  };
}

/**
 * 다루는 지역이 한 곳뿐이면 검색을 기다리지 않고 그 지역 전체를 먼저 보여준다.
 * 여러 시군구를 담게 되면 null 을 돌려줘서 사용자가 직접 고르게 한다.
 */
export function defaultArea(): Area | null {
  const [only, ...rest] = REGION_INDEX.sigungu;
  if (!only || rest.length > 0) return null;
  return sigunguArea(only);
}

/** 시작 화면에서 바로 누를 수 있는 시군구 목록. */
export function sigunguAreas(): Area[] {
  return REGION_INDEX.sigungu.map(sigunguArea).filter((area): area is Area => area != null);
}

/** 서비스 범위를 벗어난 위치인지 판단하는 기준. */
export const OUT_OF_COVERAGE_KM = 20;

/** 현재 위치 좌표에서 가장 가까운 동을 고른다. 범위를 크게 벗어나면 null. */
export function nearestArea(lat: number, lng: number): Area | null {
  let best: DongEntry | null = null;
  let bestDistance = Infinity;
  for (const dong of REGION_INDEX.dong) {
    const d = distanceKm({ lat, lng }, { lat: dong.y, lng: dong.x });
    if (d < bestDistance) {
      bestDistance = d;
      best = dong;
    }
  }
  if (!best || bestDistance > OUT_OF_COVERAGE_KM) return null;
  return toArea(best);
}

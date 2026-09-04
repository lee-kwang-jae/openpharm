/**
 * 정규화된 시설 목록을 앱이 읽는 정적 파일로 떨군다.
 *
 * 10만 건을 그대로 JSON 객체 배열로 쓰면 30MB가 넘어서 미니앱 번들에 넣기 어렵다.
 * 그래서 세 가지로 줄인다.
 *   1. 행을 객체 대신 배열로 (키 이름이 행마다 반복되지 않는다)
 *   2. 동 이름 · 종별 · 운영시간 패턴을 파일별 사전으로 빼고 인덱스만 저장
 *   3. 주소에서 "시도 시군구 " 접두사 제거 (파일 자체가 시군구 단위라 이미 안다)
 */
import { mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

export const ROW = {
  NAME: 0,
  ADDRESS: 1,
  TEL: 2,
  LAT: 3,
  LNG: 4,
  DONG: 5,
  KIND: 6,
  FLAGS: 7,
  HOURS: 8,
  NOTE: 9,
};

export const FLAG_PHARMACY = 1;
export const FLAG_EMERGENCY = 2;
export const FLAG_DONG_INFERRED = 4;

function distanceKm(a, b) {
  const R = 6371;
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.sin(dLng / 2) ** 2 * Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat));
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** 같은 값이 반복되는 컬럼을 사전 + 인덱스로 바꾼다. */
function createInterner() {
  const table = [];
  const seen = new Map();
  return {
    table,
    intern(value) {
      if (value == null) return -1;
      const key = typeof value === 'string' ? value : JSON.stringify(value);
      const existing = seen.get(key);
      if (existing != null) return existing;
      const index = table.length;
      table.push(value);
      seen.set(key, index);
      return index;
    },
  };
}

export async function emit({ places, dataDir, source, coverage }) {
  const placesDir = path.join(dataDir, 'places');
  await rm(placesDir, { recursive: true, force: true });
  await mkdir(placesDir, { recursive: true });

  const buckets = new Map();
  for (const place of places) {
    const key = `${place.sido}|${place.sigungu}`;
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(place);
  }

  const sigunguKeys = [...buckets.keys()].sort((a, b) => a.localeCompare(b, 'ko'));
  const dongIndex = [];
  const summaries = [];

  for (const [index, key] of sigunguKeys.entries()) {
    const [sido, sigungu] = key.split('|');
    const rows = buckets.get(key);

    // 동 중심 좌표는 그 동에 실제로 있는 시설들의 평균으로 잡는다.
    const centroids = new Map();
    for (const place of rows) {
      if (!place.emd) continue;
      if (!centroids.has(place.emd)) centroids.set(place.emd, { lat: 0, lng: 0, count: 0 });
      const acc = centroids.get(place.emd);
      acc.lat += place.lat;
      acc.lng += place.lng;
      acc.count += 1;
    }
    const dongs = [...centroids.entries()].map(([name, acc]) => ({
      name,
      lat: acc.lat / acc.count,
      lng: acc.lng / acc.count,
      count: acc.count,
    }));

    // 주소에서 동을 못 뽑은 시설은 가장 가까운 동에 붙인다.
    for (const place of rows) {
      if (place.emd || dongs.length === 0) continue;
      let nearest = dongs[0];
      let best = Infinity;
      for (const dong of dongs) {
        const d = distanceKm(place, dong);
        if (d < best) {
          best = d;
          nearest = dong;
        }
      }
      place.emd = nearest.name;
      place.emdInferred = true;
    }

    for (const dong of dongs) {
      dongIndex.push({
        n: dong.name,
        s: index,
        y: Number(dong.lat.toFixed(5)),
        x: Number(dong.lng.toFixed(5)),
        // 시군구 전체를 볼 때 지도 중심을 시설이 몰린 쪽으로 당기는 데 쓴다.
        c: dong.count,
      });
    }

    const dongTable = createInterner();
    const kindTable = createInterner();
    const hoursTable = createInterner();
    const prefix = `${sido} ${sigungu} `;

    const compact = rows
      .sort((a, b) => a.name.localeCompare(b.name, 'ko'))
      .map((place) => {
        let flags = 0;
        if (place.type === 'pharmacy') flags |= FLAG_PHARMACY;
        if (place.emergency) flags |= FLAG_EMERGENCY;
        if (place.emdInferred) flags |= FLAG_DONG_INFERRED;

        return [
          place.name,
          place.address.startsWith(prefix) ? place.address.slice(prefix.length) : place.address,
          place.tel ?? '',
          Number(place.lat.toFixed(5)),
          Number(place.lng.toFixed(5)),
          dongTable.intern(place.emd),
          kindTable.intern(place.kind),
          flags,
          hoursTable.intern(place.hours),
          place.note ?? '',
        ];
      });

    await writeFile(
      path.join(placesDir, `${index}.json`),
      JSON.stringify({
        p: `${sido} ${sigungu}`,
        d: dongTable.table,
        k: kindTable.table,
        h: hoursTable.table,
        r: compact,
      }),
    );
    summaries.push({ i: index, sido, name: sigungu, c: compact.length });
  }

  dongIndex.sort((a, b) => a.n.localeCompare(b.n, 'ko'));

  const regions = {
    generatedAt: new Date().toISOString(),
    source,
    coverage,
    total: places.length,
    sigungu: summaries,
    dong: dongIndex,
  };
  await writeFile(path.join(dataDir, 'regions.json'), JSON.stringify(regions));

  return { sigunguCount: summaries.length, dongCount: dongIndex.length };
}

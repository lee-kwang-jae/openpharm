import { normalizeSido } from './address.mjs';

/**
 * 앱이 다루는 지역 범위.
 *
 * 전국(10만 곳)을 다 담으면 데이터만 17MB가 넘어 번들로는 무거워서,
 * 지역을 좁혀서 내보낸다. 여기에 시군구를 추가하고 `npm run sync:data` 를
 * 다시 돌리면 (캐시를 쓰므로 API 호출 없이) 범위가 넓어진다.
 *
 * 환경변수로 임시 변경도 가능해요:
 *   SYNC_REGIONS="경기도 하남시,서울특별시 강동구" npm run sync:data
 */
export const COVERAGE = [
  { sido: '경기도', sigungu: '하남시' },
  { sido: '서울특별시', sigungu: '송파구' },
  { sido: '서울특별시', sigungu: '강동구' },
  // 성남시는 데이터상 수정구·중원구·분당구로 나뉘어 있는데, 상위 시 이름만 적으면 셋 다 잡힌다.
  { sido: '경기도', sigungu: '성남시' },
];

function parseEnv(value) {
  return value
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const parts = entry.split(/\s+/);
      const sido = parts.shift();
      return { sido, sigungu: parts.join(' ') };
    })
    .filter((entry) => entry.sido && entry.sigungu);
}

export function getCoverage() {
  const fromEnv = process.env.SYNC_REGIONS?.trim();
  return fromEnv ? parseEnv(fromEnv) : COVERAGE;
}

/** "경기도 하남시" 처럼 사람이 읽는 범위 문구. */
export function describeCoverage(coverage) {
  return coverage.map((entry) => `${entry.sido} ${entry.sigungu}`).join(', ');
}

export function createCoverageFilter(coverage) {
  // 시도 표기는 "서울시"처럼 흔들리므로 데이터와 같은 형태로 맞춘다.
  const entries = coverage.map((entry) => ({
    sido: normalizeSido(entry.sido),
    sigungu: entry.sigungu,
  }));

  return (place) =>
    entries.some(
      (entry) =>
        place.sido === entry.sido &&
        // "성남시"로 적으면 "성남시 분당구"까지 포함한다.
        (place.sigungu === entry.sigungu || place.sigungu.startsWith(`${entry.sigungu} `)),
    );
}

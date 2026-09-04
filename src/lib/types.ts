/**
 * src/data/places/{i}.json 의 압축 포맷.
 * 10만 건을 담아야 해서 행을 객체 대신 배열로 쓰고,
 * 반복되는 값(동 이름 · 종별 · 운영시간)은 파일별 사전으로 뺐다.
 * 생성 규칙은 scripts/emit.mjs 에 있다.
 */
export interface PlaceChunk {
  /** 주소 접두사. 예: "서울특별시 강남구" */
  p: string;
  /** 동 이름 사전 */
  d: string[];
  /** 종별 사전 */
  k: string[];
  /** 운영시간 패턴 사전 */
  h: number[][];
  /** 행 목록 */
  r: PlaceRow[];
}

/** [이름, 주소, 전화, 위도, 경도, 동idx, 종별idx, 플래그, 시간idx, 비고] */
export type PlaceRow = [
  string,
  string,
  string,
  number,
  number,
  number,
  number,
  number,
  number,
  string,
];

export const FLAG_PHARMACY = 1;
export const FLAG_EMERGENCY = 2;
export const FLAG_DONG_INFERRED = 4;

export type PlaceCategory = 'pharmacy' | 'clinic' | 'hospital' | 'dental' | 'oriental' | 'etc';

export interface Place {
  id: string;
  name: string;
  address: string;
  tel: string | null;
  lat: number;
  lng: number;
  dong: string | null;
  kind: string;
  category: PlaceCategory;
  isPharmacy: boolean;
  hasEmergencyRoom: boolean;
  note: string | null;
  hours: number[] | null;
  dongInferred: boolean;
  /** 검색 기준점에서의 거리(km). 기준점이 없으면 null. */
  distanceKm: number | null;
}

export interface SigunguSummary {
  /** src/data/places/{i}.json 의 i */
  i: number;
  sido: string;
  name: string;
  /** 시설 수 */
  c: number;
}

export interface DongEntry {
  /** 동 이름 */
  n: string;
  /** 소속 시군구 인덱스 */
  s: number;
  /** 중심 위도 */
  y: number;
  /** 중심 경도 */
  x: number;
  /** 이 동에 속한 시설 수 */
  c?: number;
}

export interface RegionIndex {
  generatedAt: string | null;
  source: string;
  /** 이 앱이 다루는 지역 범위. 예: "경기도 하남시" */
  coverage?: string;
  total: number;
  sigungu: SigunguSummary[];
  dong: DongEntry[];
}

export interface Area {
  kind: 'dong' | 'sigungu';
  /** 화면에 보여줄 이름 (예: "역삼동") */
  label: string;
  /** 상위 지역 (예: "서울특별시 강남구") */
  parent: string;
  sigunguIndex: number;
  /** 지도 중심 · 거리 계산 기준점 */
  lat: number;
  lng: number;
}

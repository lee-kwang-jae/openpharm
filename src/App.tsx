import { adaptive } from '@toss/tds-colors';
import { Top } from '@toss/tds-mobile';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { AreaSearch } from './components/AreaSearch';
import { DateButton } from './components/DateButton';
import { DateSheet } from './components/DateSheet';
import { FilterBar, type CategoryFilter } from './components/FilterBar';
import { PlaceDetail } from './components/PlaceDetail';
import { PlaceList } from './components/PlaceList';
import { PlaceMap } from './components/PlaceMap';
import { copyText, getCurrentCoords, openTel } from './lib/device';
import { holidayName, nextHolidayStretch, parseDateKey, toDateKey, weekdayLabel } from './lib/holidays';
import { getOpenStatus, isOperating } from './lib/hours';
import {
  COVERAGE,
  COVERAGE_SHORT,
  DATA_GENERATED_AT,
  DATA_SOURCE,
  HAS_DATA,
  REGION_INDEX,
  defaultArea,
  distanceKm,
  loadSigungu,
  nearestArea,
  sigunguAreas,
} from './lib/places';
import type { Area, Place } from './lib/types';

const AREA_STORAGE_KEY = 'holiday-care:last-area';
const NEARBY_RADIUS_KM = 1.5;
const WIDE_RADIUS_KM = 5;
/** 번화가는 반경 안에 900곳이 넘게 잡혀서 한 번에 다 그리면 화면이 버벅인다. */
const PAGE_SIZE = 30;

function readStoredArea(): Area | null {
  try {
    const raw = window.localStorage.getItem(AREA_STORAGE_KEY);
    if (!raw) return null;
    const stored = JSON.parse(raw) as Area;
    // 서비스 범위가 바뀌면 예전에 저장해둔 지역이 더는 존재하지 않을 수 있다.
    return REGION_INDEX.sigungu.some((entry) => entry.i === stored.sigunguIndex) ? stored : null;
  } catch {
    return null;
  }
}

function Banner() {
  const stretch = useMemo(() => nextHolidayStretch(), []);
  if (!stretch) return null;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const days = Math.round((stretch.start.getTime() - today.getTime()) / 86_400_000);
  const period =
    toDateKey(stretch.start) === toDateKey(stretch.end)
      ? `${stretch.start.getMonth() + 1}월 ${stretch.start.getDate()}일`
      : `${stretch.start.getMonth() + 1}월 ${stretch.start.getDate()}일 ~ ${stretch.end.getMonth() + 1}월 ${stretch.end.getDate()}일`;

  return (
    <div
      style={{
        margin: '0 20px 4px',
        padding: '12px 14px',
        borderRadius: 12,
        background: adaptive.blue50,
        color: adaptive.blue700,
        fontSize: 13,
        lineHeight: '19px',
      }}
    >
      <strong style={{ fontWeight: 700 }}>
        {days <= 0 ? `${stretch.name} 연휴예요` : `${stretch.name} 연휴까지 D-${days}`}
      </strong>
      <span style={{ marginLeft: 6, color: adaptive.blue600 }}>{period}</span>
    </div>
  );
}

function EmptyDataNotice() {
  return (
    <div style={{ padding: '40px 24px', textAlign: 'center', color: adaptive.grey600 }}>
      <p style={{ margin: '0 0 8px', fontSize: 16, fontWeight: 700, color: adaptive.grey800 }}>
        데이터가 아직 없어요
      </p>
      <p style={{ margin: 0, fontSize: 14, lineHeight: '20px' }}>
        <code style={{ fontSize: 13 }}>.env</code> 에 공공데이터포털 키를 넣고
        <br />
        <code style={{ fontSize: 13 }}>npm run sync:data</code> 를 실행해 주세요.
      </p>
    </div>
  );
}

export default function App() {
  // 날짜를 고르기 전에는 오늘 기준으로 본다.
  const [dateKey, setDateKey] = useState(() => toDateKey(new Date()));
  const [datePicked, setDatePicked] = useState(false);
  const [dateSheetOpen, setDateSheetOpen] = useState(false);
  const [area, setArea] = useState<Area | null>(() => readStoredArea() ?? defaultArea());
  const [category, setCategory] = useState<CategoryFilter>('all');
  const [onlyOpen, setOnlyOpen] = useState(true);
  const [wideRadius, setWideRadius] = useState(false);
  const [places, setPlaces] = useState<Place[]>([]);
  const [loading, setLoading] = useState(false);
  const [locating, setLocating] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  // 초 단위까지 볼 필요는 없어서 1분마다만 현재 시각을 새로 잡는다.
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const targetDate = useMemo(() => parseDateKey(dateKey), [dateKey]);
  const regionShortcuts = useMemo(() => sigunguAreas(), []);

  useEffect(() => {
    if (!area) return;
    let cancelled = false;
    setLoading(true);
    loadSigungu(area.sigunguIndex)
      .then((rows) => {
        if (!cancelled) setPlaces(rows);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [area]);

  useEffect(() => {
    if (!area) return;
    try {
      window.localStorage.setItem(AREA_STORAGE_KEY, JSON.stringify(area));
    } catch {
      // 저장에 실패해도 앱 동작에는 영향이 없다.
    }
  }, [area]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 2000);
    return () => window.clearTimeout(timer);
  }, [toast]);

  /** 선택한 동 주변으로 좁힌 뒤, 거리를 붙여서 가까운 순으로 정렬한다. */
  const inArea = useMemo(() => {
    if (!area) return [];
    const radius = wideRadius ? WIDE_RADIUS_KM : NEARBY_RADIUS_KM;
    const center = { lat: area.lat, lng: area.lng };

    return places
      .map((place) => ({ ...place, distanceKm: distanceKm(center, place) }))
      .filter((place) => {
        if (area.kind === 'sigungu') return true;
        return place.dong === area.label || place.distanceKm <= radius;
      })
      .sort((a, b) => a.distanceKm - b.distanceKm);
  }, [places, area, wideRadius]);

  const openFiltered = useMemo(() => {
    if (!onlyOpen) return inArea;
    return inArea.filter((place) => isOperating(getOpenStatus(place, targetDate, now).state));
  }, [inArea, onlyOpen, targetDate, now]);

  const counts = useMemo(() => {
    const result: Partial<Record<CategoryFilter, number>> = { all: openFiltered.length };
    for (const place of openFiltered) {
      result[place.category] = (result[place.category] ?? 0) + 1;
    }
    return result;
  }, [openFiltered]);

  const visible = useMemo(
    () => (category === 'all' ? openFiltered : openFiltered.filter((place) => place.category === category)),
    [openFiltered, category],
  );

  const selected = useMemo(() => visible.find((place) => place.id === selectedId) ?? null, [visible, selectedId]);

  const [shown, setShown] = useState(PAGE_SIZE);
  // 지역·날짜·필터가 바뀌면 처음부터 다시 보여준다.
  useEffect(() => {
    setShown(PAGE_SIZE);
  }, [area, dateKey, category, onlyOpen, wideRadius]);
  const paged = useMemo(() => visible.slice(0, shown), [visible, shown]);

  const handleUseCurrentLocation = useCallback(async () => {
    setLocating(true);
    try {
      const coords = await getCurrentCoords();
      const found = nearestArea(coords.lat, coords.lng);
      if (found) {
        setArea(found);
        setSelectedId(null);
      } else {
        setToast(COVERAGE_SHORT ? `지금은 ${COVERAGE_SHORT} 정보만 담고 있어요.` : '가까운 지역을 찾지 못했어요.');
      }
    } catch (error) {
      setToast(error instanceof Error ? error.message : '위치를 가져오지 못했어요.');
    } finally {
      setLocating(false);
    }
  }, []);

  const targetHoliday = holidayName(targetDate);

  return (
    <div style={{ paddingBottom: 40, background: adaptive.background, minHeight: '100vh' }}>
      <Top
        title={<Top.TitleParagraph size={22}>연휴 약국·병원 찾기</Top.TitleParagraph>}
        subtitleBottom={
          <Top.SubtitleParagraph size={15}>
            공휴일에 문 여는 약국과 병·의원을 동 이름으로 찾아보세요.
            {COVERAGE_SHORT ? ` 지금은 ${COVERAGE_SHORT}를 담고 있어요.` : ''}
          </Top.SubtitleParagraph>
        }
      />

      <Banner />

      {!HAS_DATA ? (
        <EmptyDataNotice />
      ) : (
        <>
          <AreaSearch
            onPick={setArea}
            onUseCurrentLocation={handleUseCurrentLocation}
            locating={locating}
            coverage={COVERAGE_SHORT}
            trailing={
              <DateButton picked={datePicked} date={targetDate} onClick={() => setDateSheetOpen(true)} />
            }
          />

          <div style={{ padding: '10px 20px 0' }}>
            {datePicked ? (
              <p style={{ margin: 0, fontSize: 13, color: adaptive.grey600, lineHeight: '19px' }}>
                <strong style={{ color: adaptive.grey800 }}>
                  {targetDate.getMonth() + 1}월 {targetDate.getDate()}일 ({weekdayLabel(targetDate)})
                  {targetHoliday ? ` · ${targetHoliday}` : ''}
                </strong>
                <span> 기준으로 보여드려요.</span>
                <button
                  type="button"
                  onClick={() => {
                    setDateKey(toDateKey(new Date()));
                    setDatePicked(false);
                  }}
                  style={{
                    marginLeft: 6,
                    padding: 0,
                    border: 'none',
                    background: 'transparent',
                    color: adaptive.blue500,
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  오늘로 되돌리기
                </button>
              </p>
            ) : (
              <p style={{ margin: 0, fontSize: 13, color: adaptive.grey500, lineHeight: '19px' }}>
                날짜를 고르지 않으면 <strong style={{ color: adaptive.grey700 }}>오늘</strong>(
                {targetDate.getMonth() + 1}/{targetDate.getDate()} {weekdayLabel(targetDate)}) 기준으로 찾아드려요.
                날짜는 📅 버튼에서 바꿀 수 있어요.
              </p>
            )}
          </div>

          {area == null ? (
            <div style={{ padding: '40px 24px', textAlign: 'center', color: adaptive.grey500 }}>
              <p style={{ margin: '0 0 6px', fontSize: 16, fontWeight: 700, color: adaptive.grey700 }}>
                어느 동네를 찾아볼까요?
              </p>
              <p style={{ margin: '0 0 20px', fontSize: 14, lineHeight: '20px' }}>
                위 검색창에 동 이름을 입력하거나
                <br />
                아래에서 지역을 골라보세요.
              </p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
                {regionShortcuts.map((shortcut) => (
                  <button
                    key={`${shortcut.sigunguIndex}`}
                    type="button"
                    onClick={() => setArea(shortcut)}
                    style={{
                      padding: '9px 14px',
                      borderRadius: 999,
                      border: `1px solid ${adaptive.grey200}`,
                      background: 'transparent',
                      color: adaptive.grey700,
                      fontSize: 14,
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    {shortcut.label}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <>
              <div style={{ marginTop: 16 }}>
                <PlaceMap
                  center={{ lat: area.lat, lng: area.lng }}
                  places={visible}
                  selectedId={selectedId}
                  onSelect={(place) => setSelectedId(place.id)}
                  height={260}
                  // 동은 걸어갈 거리라 크게, 시군구는 전체가 들어오게 넓게 본다.
                  level={area.kind === 'dong' ? 4 : 6}
                />
              </div>

              <div
                style={{
                  display: 'flex',
                  alignItems: 'baseline',
                  gap: 6,
                  padding: '16px 20px 12px',
                }}
              >
                <strong style={{ fontSize: 18, color: adaptive.grey800 }}>
                  {area.label}
                  {area.kind === 'dong' ? ' 주변' : ''}
                </strong>
                <span style={{ fontSize: 13, color: adaptive.grey500 }}>
                  {targetDate.getMonth() + 1}/{targetDate.getDate()} ({weekdayLabel(targetDate)})
                  {targetHoliday ? ` · ${targetHoliday}` : ''}
                </span>
              </div>

              <FilterBar
                category={category}
                onCategoryChange={setCategory}
                onlyOpen={onlyOpen}
                onOnlyOpenChange={setOnlyOpen}
                counts={counts}
              />

              <p style={{ margin: '12px 20px 8px', fontSize: 12, color: adaptive.grey500 }}>
                {area.label} 중심에서 가까운 순 · {visible.length}곳
              </p>

              {loading ? (
                <p style={{ padding: '32px 20px', textAlign: 'center', color: adaptive.grey500 }}>불러오는 중…</p>
              ) : visible.length === 0 ? (
                <div style={{ padding: '32px 24px', textAlign: 'center', color: adaptive.grey500 }}>
                  <p style={{ margin: '0 0 12px', fontSize: 14, lineHeight: '20px' }}>
                    조건에 맞는 곳이 없어요.
                    <br />
                    필터를 바꾸거나 범위를 넓혀보세요.
                  </p>
                  {!wideRadius && area.kind === 'dong' ? (
                    <button
                      type="button"
                      onClick={() => setWideRadius(true)}
                      style={{
                        padding: '9px 16px',
                        borderRadius: 999,
                        border: `1px solid ${adaptive.grey200}`,
                        background: 'transparent',
                        color: adaptive.grey700,
                        fontSize: 13,
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      {WIDE_RADIUS_KM}km 범위로 넓혀보기
                    </button>
                  ) : null}
                </div>
              ) : (
                <>
                  <PlaceList
                    places={paged}
                    targetDate={targetDate}
                    now={now}
                    selectedId={selectedId}
                    onSelect={(place) => setSelectedId(place.id)}
                  />
                  {shown < visible.length ? (
                    <div style={{ padding: '16px 20px' }}>
                      <button
                        type="button"
                        onClick={() => setShown((value) => value + PAGE_SIZE * 2)}
                        style={{
                          width: '100%',
                          padding: '13px 0',
                          borderRadius: 12,
                          border: `1px solid ${adaptive.grey200}`,
                          background: 'transparent',
                          color: adaptive.grey700,
                          fontSize: 15,
                          fontWeight: 600,
                          cursor: 'pointer',
                        }}
                      >
                        {visible.length - shown}곳 더 보기
                      </button>
                    </div>
                  ) : null}
                </>
              )}
            </>
          )}
        </>
      )}

      <footer style={{ padding: '24px 20px 0', color: adaptive.grey500, fontSize: 12, lineHeight: '18px' }}>
        {COVERAGE ? (
          <p style={{ margin: '0 0 4px' }}>
            서비스 지역: {COVERAGE} ({REGION_INDEX.total.toLocaleString()}곳)
          </p>
        ) : null}
        <p style={{ margin: '0 0 4px' }}>데이터 출처: {DATA_SOURCE}</p>
        {DATA_GENERATED_AT ? (
          <p style={{ margin: '0 0 4px' }}>기준 시점: {new Date(DATA_GENERATED_AT).toLocaleDateString('ko-KR')}</p>
        ) : null}
        <p style={{ margin: 0 }}>
          이 앱은 공공데이터를 그대로 보여줄 뿐, 특정 기관을 추천하거나 순위를 매기지 않아요. 예약·진료 연결 기능은
          제공하지 않으며 운영시간은 실제와 다를 수 있어요.
        </p>
      </footer>

      {dateSheetOpen ? (
        <DateSheet
          value={dateKey}
          today={now}
          onPick={(key) => {
            setDateKey(key);
            setDatePicked(true);
            setDateSheetOpen(false);
            setSelectedId(null);
          }}
          onClose={() => setDateSheetOpen(false)}
        />
      ) : null}

      {selected ? (
        <PlaceDetail
          place={selected}
          targetDate={targetDate}
          now={now}
          originLabel={area?.label ?? ''}
          onClose={() => setSelectedId(null)}
          onCall={(place) => {
            if (place.tel) void openTel(place.tel);
          }}
          onCopyAddress={(place) => {
            void copyText(place.address)
              .then(() => setToast('주소를 복사했어요.'))
              .catch(() => setToast('주소를 복사하지 못했어요.'));
          }}
        />
      ) : null}

      {toast ? (
        <div
          role="status"
          style={{
            position: 'fixed',
            left: '50%',
            bottom: 'calc(32px + env(safe-area-inset-bottom, 0px))',
            transform: 'translateX(-50%)',
            zIndex: 200,
            padding: '11px 18px',
            borderRadius: 999,
            background: 'rgba(30,32,37,.92)',
            color: '#FFFFFF',
            fontSize: 14,
            whiteSpace: 'nowrap',
          }}
        >
          {toast}
        </div>
      ) : null}
    </div>
  );
}

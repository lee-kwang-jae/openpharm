// 국립중앙의료원(E-Gen) 공공데이터 API 클라이언트.
// 응답이 XML 뿐이라 의존성 없이 <item> 블록만 얕게 파싱한다.

const BASE = 'https://apis.data.go.kr/B552657';

export const SERVICES = {
  pharmacy: {
    path: `${BASE}/ErmctInsttInfoInqireService`,
    full: 'getParmacyFullDown',
    list: 'getParmacyListInfoInqire',
  },
  hospital: {
    path: `${BASE}/HsptlAsembySearchService`,
    full: 'getHsptlMdcncFullDown',
    list: 'getHsptlMdcncListInfoInqire',
  },
};

const TAG_RE = /<(\w+)>([\s\S]*?)<\/\1>/g;

function decode(raw) {
  const cdata = raw.match(/^<!\[CDATA\[([\s\S]*)\]\]>$/);
  const text = cdata ? cdata[1] : raw;
  return text
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&')
    .trim();
}

/** <item>…</item> 블록을 평평한 객체 배열로 바꾼다. */
export function parseItems(xml) {
  const items = [];
  for (const block of xml.matchAll(/<item>([\s\S]*?)<\/item>/g)) {
    const row = {};
    for (const [, key, value] of block[1].matchAll(TAG_RE)) {
      if (value.includes('<item>')) continue;
      row[key] = decode(value);
    }
    items.push(row);
  }
  return items;
}

function pickNumber(xml, tag) {
  const m = xml.match(new RegExp('<' + tag + '>\\s*(\\d+)\\s*</' + tag + '>'));
  return m ? Number(m[1]) : null;
}

export function readTotalCount(xml) {
  return pickNumber(xml, 'totalCount');
}

export function readError(xml) {
  const msg = xml.match(/<(?:errMsg|returnAuthMsg|resultMsg)>([\s\S]*?)<\/(?:errMsg|returnAuthMsg|resultMsg)>/);
  const code = xml.match(/<(?:returnReasonCode|resultCode)>([\s\S]*?)<\/(?:returnReasonCode|resultCode)>/);
  if (!msg) return null;
  const text = decode(msg[1]);
  const codeText = code ? decode(code[1]) : '';
  // 정상 응답도 resultCode 00 / NORMAL SERVICE 를 담고 있으므로 걸러낸다.
  if (/^(00|0)$/.test(codeText) || /NORMAL/i.test(text)) return null;
  return `${text}${codeText ? ` (${codeText})` : ''}`;
}

export async function fetchPage({ serviceKey, service, operation, pageNo, numOfRows, extra = {} }) {
  const url = new URL(`${service.path}/${operation}`);
  // serviceKey 는 이미 인코딩된 값이 배포되므로 URLSearchParams 로 다시 인코딩하지 않는다.
  const params = new URLSearchParams({ pageNo: String(pageNo), numOfRows: String(numOfRows), ...extra });
  url.search = `serviceKey=${serviceKey}&${params.toString()}`;

  const res = await fetch(url, { headers: { Accept: 'application/xml' } });
  const xml = await res.text();
  const error = readError(xml);
  if (error) throw new Error(`${operation} 실패: ${error}`);
  if (!res.ok) throw new Error(`${operation} HTTP ${res.status}`);
  return { xml, items: parseItems(xml), totalCount: readTotalCount(xml) };
}

/** 전체 목록을 페이지 단위로 모두 받아온다. */
export async function fetchAll({ serviceKey, service, operation, pageSize = 1000, extra, onProgress }) {
  const collected = [];
  let pageNo = 1;
  let total = Infinity;

  while (collected.length < total) {
    const { items, totalCount } = await fetchPage({
      serviceKey,
      service,
      operation,
      pageNo,
      numOfRows: pageSize,
      extra,
    });
    if (totalCount != null) total = totalCount;
    if (items.length === 0) break;
    collected.push(...items);
    onProgress?.(collected.length, Number.isFinite(total) ? total : null);
    if (items.length < pageSize) break;
    pageNo += 1;
  }
  return collected;
}

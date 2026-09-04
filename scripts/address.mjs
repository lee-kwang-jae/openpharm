// E-Gen 주소 문자열에서 시도 / 시군구 / 읍면동을 뽑아낸다.
//
// 실제 데이터는 대부분 도로명 주소이고, 법정동은 끝의 괄호 안에 들어있다.
//   "인천광역시 서구 한중1로 14, 센트럴빌딩 107호 (백석동)"
//   "경기도 안양시 만안구 병목안로 2, 402호 (안양동, PROJECT 240 TOWER)"
// 군 지역은 읍·면이 도로명 앞에 그대로 남아 있다.
//   "울산광역시 울주군 범서읍 천상중앙길 102, 1층 102호"
// 옛 지번 주소도 일부 섞여 있다.
//   "서울특별시 강남구 역삼동 825-20"

const PROVINCES = new Set([
  '경기도', '강원도', '강원특별자치도', '충청북도', '충청남도',
  '전라북도', '전북특별자치도', '전라남도', '경상북도', '경상남도',
  '제주도', '제주특별자치도',
]);

// 시도 표기가 데이터마다 흔들려서 한 가지로 모은다.
const SIDO_ALIAS = new Map([
  ['서울', '서울특별시'], ['서울시', '서울특별시'],
  ['부산', '부산광역시'], ['대구', '대구광역시'], ['인천', '인천광역시'],
  ['광주', '광주광역시'], ['대전', '대전광역시'], ['울산', '울산광역시'],
  ['세종', '세종특별자치시'], ['세종시', '세종특별자치시'], ['세종특별시', '세종특별자치시'],
  ['경기', '경기도'], ['강원', '강원특별자치도'], ['강원도', '강원특별자치도'],
  ['충북', '충청북도'], ['충남', '충청남도'],
  ['전북', '전북특별자치도'], ['전라북도', '전북특별자치도'], ['전남', '전라남도'],
  ['경북', '경상북도'], ['경남', '경상남도'],
  ['제주', '제주특별자치도'], ['제주도', '제주특별자치도'],
]);

const EUP_MYEON = /(읍|면)$/;
const DONG = /(동|가)$/;
const RI = /리$/;

export function normalizeSido(token) {
  return SIDO_ALIAS.get(token) ?? token;
}

/** 주소 끝 괄호에서 법정동 후보를 꺼낸다. "(안양동, PROJECT 240 TOWER)" → "안양동" */
function fromParentheses(raw) {
  const candidates = [];
  for (const match of raw.matchAll(/\(([^)]*)\)/g)) {
    for (const part of match[1].split(',')) {
      const token = part.trim();
      // "1층", "제2호" 같은 층·호수 표기가 섞여 들어오지 않게 거른다.
      if (!token || token.length < 2 || /^\d/.test(token)) continue;
      if (EUP_MYEON.test(token) || DONG.test(token) || RI.test(token)) candidates.push(token);
    }
  }
  return candidates;
}

/**
 * @returns {{sido: string, sigungu: string, emd: string|null} | null}
 */
export function parseAddress(raw) {
  if (!raw) return null;
  const text = String(raw).replace(/\s+/g, ' ').trim();
  // 시도·시군구를 셀 때 괄호 안 내용이 끼어들지 않게 떼어낸다.
  const head = text.replace(/\([^)]*\)/g, ' ').replace(/\s+/g, ' ').trim();
  const tokens = head.split(' ');
  if (tokens.length < 2) return null;

  const sido = normalizeSido(tokens[0]);
  if (!/(시|도)$/.test(sido)) return null;

  let cursor = 1;
  let sigungu = tokens[cursor];

  if (sido === '세종특별자치시') {
    // 세종은 시군구 단계가 없어서 바로 읍면동이 온다.
    sigungu = '세종특별자치시';
  } else {
    cursor += 1;
    // 경기도 성남시 분당구처럼 시 아래 구가 한 번 더 있는 경우.
    if (PROVINCES.has(sido) && /시$/.test(sigungu) && /구$/.test(tokens[cursor] ?? '')) {
      sigungu = `${sigungu} ${tokens[cursor]}`;
      cursor += 1;
    }
  }
  if (!sigungu || !/(시|군|구)$/.test(sigungu.split(' ').pop() ?? '')) return null;

  // 읍·면은 도로명 앞에 그대로 남아 있어서 가장 신뢰할 만하다.
  let emd = null;
  for (let i = cursor; i < Math.min(tokens.length, cursor + 2); i += 1) {
    if (EUP_MYEON.test(tokens[i] ?? '')) {
      emd = tokens[i];
      break;
    }
  }

  // 그다음은 괄호 안의 법정동.
  if (!emd) {
    const parenthesized = fromParentheses(text);
    emd = parenthesized.find((name) => DONG.test(name) || EUP_MYEON.test(name)) ?? parenthesized[0] ?? null;
  }

  // 마지막으로 옛 지번 주소 형태를 훑는다.
  if (!emd) {
    for (let i = cursor; i < Math.min(tokens.length, cursor + 2); i += 1) {
      const token = tokens[i];
      if (token && DONG.test(token) && !/^\d/.test(token)) {
        emd = token;
        break;
      }
    }
  }

  return { sido, sigungu, emd };
}

/** "역삼1동" → "역삼동" 처럼 행정동 번호를 떼서 묶음 키를 만든다. */
export function baseEmd(name) {
  if (!name) return null;
  // "종로1가", "봉래동2가"처럼 '가'로 끝나는 이름은 번호가 이름의 일부라 건드리지 않는다.
  if (/가$/.test(name)) return name;
  const stripped = name.replace(/(제)?\d+(동|읍|면)$/, '$2');
  return stripped || name;
}

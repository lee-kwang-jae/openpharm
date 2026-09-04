import { adaptive } from '@toss/tds-colors';

interface Props {
  title: string;
  subtitle: string;
}

/**
 * @toss/tds-mobile 의 Top 을 대신하는 헤더.
 *
 * TDS 는 앱인토스 도메인 밖에서 실행을 거부해서("@toss/tds-mobile은 앱인토스
 * 개발에만 사용할 수 있어요") GitHub Pages 웹 버전에서 앱이 통째로 죽는다.
 * 쓰던 곳이 이 헤더 하나뿐이라 걷어내고 직접 그린다.
 */
export function AppHeader({ title, subtitle }: Props) {
  return (
    <header style={{ padding: '24px 20px 14px' }}>
      <h1
        style={{
          margin: '0 0 6px',
          fontSize: 24,
          lineHeight: '32px',
          fontWeight: 700,
          letterSpacing: '-0.4px',
          color: adaptive.grey800,
        }}
      >
        {title}
      </h1>
      <p style={{ margin: 0, fontSize: 15, lineHeight: '22px', color: adaptive.grey600 }}>{subtitle}</p>
    </header>
  );
}

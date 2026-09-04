/// <reference types="vite/client" />

declare module '*.css' {
  const content: Record<string, string>;
  export default content;
}

interface ImportMetaEnv {
  /** 카카오 개발자센터에서 발급한 JavaScript 키 */
  readonly VITE_KAKAO_MAP_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

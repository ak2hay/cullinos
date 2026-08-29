/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
  readonly VITE_OUTLET_ID?: string;
  readonly VITE_ORDER_TOKEN?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

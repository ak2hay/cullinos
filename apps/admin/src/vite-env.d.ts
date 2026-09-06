/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
  readonly VITE_KDS_URL?: string;
  readonly VITE_POS_URL?: string;
  readonly VITE_CUSTOMER_URL?: string;
  readonly VITE_RAZORPAY_KEY_ID?: string;
  readonly VITE_SUPER_ADMIN_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

export type ConfigGroupId =
  | "portals"
  | "smtp"
  | "resend"
  | "r2"
  | "razorpay"
  | "openai"
  | "webhooks"
  | "revalidate"
  | "msg91"
  | "fcm"
  | "guest_app"
  | "billing";

export type ConfigKeyDef = {
  key: string;
  isSecret: boolean;
  label: string;
  /** Rendered as a toggle; stored as "true" / "false". */
  type?: "boolean";
  /** Effective value when neither DB nor environment sets the key. */
  defaultValue?: string;
};

export type ConfigGroupDef = {
  id: ConfigGroupId;
  label: string;
  description: string;
  keys: ConfigKeyDef[];
};

export const CONFIG_GROUPS: ConfigGroupDef[] = [
  {
    id: "portals",
    label: "Portals",
    description:
      "Platform-wide switches and maintenance. Turning a portal off blocks sign-in and API calls from that client for every tenant. Non-empty maintenance text puts the portal in maintenance (separate UI from disabled). Super Admin (platform.cullinos.com) is never gated.",
    keys: [
      {
        key: "PORTAL_MANAGEMENT_ENABLED",
        isSecret: false,
        label: "Management web (manage.cullinos.com)",
        type: "boolean",
        defaultValue: "true",
      },
      {
        key: "PORTAL_MANAGEMENT_MAINTENANCE",
        isSecret: false,
        label: "Management maintenance message (empty = off)",
      },
      {
        key: "PORTAL_ADMIN_ENABLED",
        isSecret: false,
        label: "Admin web (admin.cullinos.com)",
        type: "boolean",
        defaultValue: "true",
      },
      {
        key: "PORTAL_ADMIN_MAINTENANCE",
        isSecret: false,
        label: "Admin maintenance message (empty = off)",
      },
      {
        key: "PORTAL_POS_ENABLED",
        isSecret: false,
        label: "POS web",
        type: "boolean",
        defaultValue: "true",
      },
      {
        key: "PORTAL_POS_MAINTENANCE",
        isSecret: false,
        label: "POS maintenance message (empty = off)",
      },
      {
        key: "PORTAL_KDS_ENABLED",
        isSecret: false,
        label: "KDS web",
        type: "boolean",
        defaultValue: "true",
      },
      {
        key: "PORTAL_KDS_MAINTENANCE",
        isSecret: false,
        label: "KDS maintenance message (empty = off)",
      },
      {
        key: "PORTAL_APP_OPS_ENABLED",
        isSecret: false,
        label: "App Ops (app.cullinos.com)",
        type: "boolean",
        defaultValue: "true",
      },
      {
        key: "PORTAL_APP_OPS_MAINTENANCE",
        isSecret: false,
        label: "App Ops maintenance message (empty = off)",
      },
      {
        key: "PORTAL_WAITER_ENABLED",
        isSecret: false,
        label: "Waiter app (Android)",
        type: "boolean",
        defaultValue: "true",
      },
      {
        key: "PORTAL_WAITER_MAINTENANCE",
        isSecret: false,
        label: "Waiter app maintenance message (empty = off)",
      },
      {
        key: "PORTAL_WAITER_LANDING_ENABLED",
        isSecret: false,
        label: "Waiter landing (waiter.cullinos.com)",
        type: "boolean",
        defaultValue: "true",
      },
      {
        key: "PORTAL_WAITER_LANDING_MAINTENANCE",
        isSecret: false,
        label: "Waiter landing maintenance message (empty = off)",
      },
      {
        key: "PORTAL_DISABLED_MESSAGE",
        isSecret: false,
        label: "Message shown when a portal is off (optional)",
      },
      {
        key: "WAITER_APP_PLAY_STORE_URL",
        isSecret: false,
        label:
          "Waiter app Play Store URL (waiter.cullinos.com shows 'coming soon' while empty)",
      },
    ],
  },
  {
    id: "smtp",
    label: "SMTP (transactional / staff OTP)",
    description:
      "Transactional mail (OTP, invoices, password reset). Prefer From on mail.yourdomain.com. Use Test SMTP after saving.",
    keys: [
      { key: "SMTP_HOST", isSecret: false, label: "Host" },
      { key: "SMTP_PORT", isSecret: false, label: "Port" },
      { key: "SMTP_USER", isSecret: false, label: "Username" },
      { key: "SMTP_PASS", isSecret: true, label: "Password" },
      { key: "SMTP_FROM_EMAIL", isSecret: false, label: "From email (transactional)" },
      { key: "SMTP_FROM_NAME", isSecret: false, label: "From name" },
      {
        key: "SMTP_MARKETING_FROM_EMAIL",
        isSecret: false,
        label: "Marketing From email (news.yourdomain.com)",
      },
      {
        key: "SMTP_MARKETING_FROM_NAME",
        isSecret: false,
        label: "Marketing From name",
      },
    ],
  },
  {
    id: "resend",
    label: "Resend",
    description: "Owner onboarding credential emails",
    keys: [
      { key: "RESEND_API_KEY", isSecret: true, label: "API key" },
      { key: "MAIL_FROM_EMAIL", isSecret: false, label: "From email" },
    ],
  },
  {
    id: "r2",
    label: "Cloudflare R2",
    description: "Object storage for marketing CMS uploads",
    keys: [
      { key: "R2_ACCOUNT_ID", isSecret: false, label: "Account ID" },
      { key: "R2_ACCESS_KEY_ID", isSecret: false, label: "Access key ID" },
      { key: "R2_SECRET_ACCESS_KEY", isSecret: true, label: "Secret access key" },
      { key: "R2_BUCKET", isSecret: false, label: "Bucket" },
      { key: "R2_PUBLIC_URL", isSecret: false, label: "Public URL" },
      { key: "R2_ENDPOINT", isSecret: false, label: "Endpoint (optional)" },
    ],
  },
  {
    id: "razorpay",
    label: "Razorpay",
    description: "Payments and subscription billing",
    keys: [
      { key: "RAZORPAY_KEY_ID", isSecret: false, label: "Key ID" },
      { key: "RAZORPAY_KEY_SECRET", isSecret: true, label: "Key secret" },
      {
        key: "RAZORPAY_WEBHOOK_SECRET",
        isSecret: true,
        label: "Webhook secret",
      },
    ],
  },
  {
    id: "openai",
    label: "OpenAI",
    description: "API key for future AI features",
    keys: [{ key: "OPENAI_API_KEY", isSecret: true, label: "API key" }],
  },
  {
    id: "webhooks",
    label: "Internal / Rkyves",
    description: "Provisioning webhooks and internal API key",
    keys: [
      { key: "RKYVES_WEBHOOK_URL", isSecret: false, label: "Webhook URL" },
      { key: "RKYVES_WEBHOOK_SECRET", isSecret: true, label: "Webhook secret" },
      { key: "INTERNAL_API_KEY", isSecret: true, label: "Internal API key" },
    ],
  },
  {
    id: "revalidate",
    label: "Marketing revalidate",
    description: "Next.js ISR revalidation hook",
    keys: [
      {
        key: "MARKETING_REVALIDATE_URL",
        isSecret: false,
        label: "Revalidate URL",
      },
      { key: "REVALIDATE_SECRET", isSecret: true, label: "Revalidate secret" },
    ],
  },
  {
    id: "msg91",
    label: "Phone OTP (MSG91)",
    description:
      "Guest app prefers Widget (ID + tokenAuth). Waiter/staff phone OTP requires Flow: Auth key + Flow template ID (+ sender). Widget alone is not enough for Waiter. OTP Flow expects OTP var; marketing Flow expects MESSAGE var.",
    keys: [
      { key: "MSG91_AUTH_KEY", isSecret: true, label: "Auth key (server verify)" },
      {
        key: "MSG91_WIDGET_ID",
        isSecret: false,
        label: "Widget ID (guest app)",
      },
      {
        key: "MSG91_WIDGET_TOKEN",
        isSecret: true,
        label: "Widget tokenAuth (guest client)",
      },
      {
        key: "MSG91_TEMPLATE_ID",
        isSecret: false,
        label: "Flow template ID (required for Waiter/staff SMS OTP)",
      },
      {
        key: "MSG91_MARKETING_TEMPLATE_ID",
        isSecret: false,
        label: "Marketing SMS template ID (MESSAGE var)",
      },
      { key: "MSG91_SENDER_ID", isSecret: false, label: "Sender ID" },
      {
        key: "MSG91_OTP_TTL_SECONDS",
        isSecret: false,
        label: "OTP TTL (seconds)",
      },
    ],
  },
  {
    id: "billing",
    label: "Portal wallet & SMS pricing",
    description:
      "Prepaid wallet pricing for Cullinos portal addons. SMS campaigns deduct pro-rata from SMS_PRICE_PER_100_PAISE (e.g. 10000 = ₹100 per 100 SMS).",
    keys: [
      {
        key: "SMS_PRICE_PER_100_PAISE",
        isSecret: false,
        label: "SMS price per 100 messages (paise)",
      },
    ],
  },
  {
    id: "fcm",
    label: "Firebase Cloud Messaging",
    description:
      "Push for Cullinos Guest (order status + marketing). Legacy server key required for device delivery.",
    keys: [
      { key: "FCM_SERVER_KEY", isSecret: true, label: "Legacy server key" },
    ],
  },
  {
    id: "guest_app",
    label: "Cullinos App",
    description:
      "Cullinos App Android controls. GUEST_OTP_DEBUG_IN_PROD shows OTP on-screen — temporary only; disable after MSG91 Flow is live.",
    keys: [
      {
        key: "GUEST_APP_MIN_VERSION",
        isSecret: false,
        label: "Minimum Android version code",
      },
      {
        key: "GUEST_APP_FORCE_UPDATE",
        isSecret: false,
        label: "Force update (true/false)",
      },
      {
        key: "GUEST_APP_SOFT_UPDATE_MESSAGE",
        isSecret: false,
        label: "Soft update message (optional)",
      },
      {
        key: "GUEST_APP_MAINTENANCE",
        isSecret: false,
        label: "Maintenance mode message",
      },
      {
        key: "GUEST_APP_PLAY_STORE_URL",
        isSecret: false,
        label: "Play Store URL",
      },
      {
        key: "GUEST_APP_SUPPORT_URL",
        isSecret: false,
        label: "Support URL",
      },
      {
        key: "GUEST_APP_PRIVACY_URL",
        isSecret: false,
        label: "Privacy policy URL",
      },
      {
        key: "GUEST_APP_TERMS_URL",
        isSecret: false,
        label: "Terms of service URL",
      },
      {
        key: "GUEST_APP_FEATURE_FLAGS",
        isSecret: false,
        label: "Feature flags JSON (optional)",
      },
      {
        key: "GUEST_APP_PHONE_MENU_QR_ENABLED",
        isSecret: false,
        label: "Phone menu / takeaway QR (true/false)",
      },
      {
        key: "GUEST_OTP_DEBUG_IN_PROD",
        isSecret: false,
        label: "Guest OTP on-screen code (temp, true/false)",
      },
      {
        key: "PLATFORM_DEFAULT_GUEST_THEME_KEY",
        isSecret: false,
        label:
          "Default guest restaurant theme (classic|forest|ocean|spice|charcoal|sunset)",
      },
    ],
  },
];

export const ALL_CONFIG_KEYS = new Map(
  CONFIG_GROUPS.flatMap((g) => g.keys.map((k) => [k.key, { ...k, group: g.id }])),
);

export function isConfigGroupId(value: string): value is ConfigGroupId {
  return CONFIG_GROUPS.some((g) => g.id === value);
}

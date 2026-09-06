export type ConfigGroupId =
  | "smtp"
  | "resend"
  | "r2"
  | "razorpay"
  | "openai"
  | "webhooks"
  | "revalidate"
  | "msg91";

export type ConfigKeyDef = {
  key: string;
  isSecret: boolean;
  label: string;
};

export type ConfigGroupDef = {
  id: ConfigGroupId;
  label: string;
  description: string;
  keys: ConfigKeyDef[];
};

export const CONFIG_GROUPS: ConfigGroupDef[] = [
  {
    id: "smtp",
    label: "SMTP",
    description: "Brevo/SMTP for OTP and promotional email",
    keys: [
      { key: "SMTP_HOST", isSecret: false, label: "Host" },
      { key: "SMTP_PORT", isSecret: false, label: "Port" },
      { key: "SMTP_USER", isSecret: false, label: "Username" },
      { key: "SMTP_PASS", isSecret: true, label: "Password" },
      { key: "SMTP_FROM_EMAIL", isSecret: false, label: "From email" },
      { key: "SMTP_FROM_NAME", isSecret: false, label: "From name" },
      {
        key: "AUTH_SKIP_EMAIL_OTP",
        isSecret: false,
        label: "Skip email OTP (temporary)",
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
    description: "Customer phone OTP via MSG91 Flow API",
    keys: [
      { key: "MSG91_AUTH_KEY", isSecret: true, label: "Auth key" },
      { key: "MSG91_TEMPLATE_ID", isSecret: false, label: "Template ID" },
      { key: "MSG91_SENDER_ID", isSecret: false, label: "Sender ID" },
      {
        key: "MSG91_OTP_TTL_SECONDS",
        isSecret: false,
        label: "OTP TTL (seconds)",
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

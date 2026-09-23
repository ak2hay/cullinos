/** Current DPDP notice version shown at collection points and stored on consent rows. */
export const DPDP_NOTICE_VERSION = "2026-09-10";

export const DPDP_PURPOSES = {
  ACCOUNT_AUTH: "account_auth",
  SERVICE: "service_delivery",
  MARKETING_EMAIL: "marketing_email",
  MARKETING_SMS: "marketing_sms",
  ANALYTICS: "analytics",
  HOSPITALITY_ID: "hospitality_id_verification",
} as const;

export type DpdpPurpose = (typeof DPDP_PURPOSES)[keyof typeof DPDP_PURPOSES];

export const DPDP_NOTICE_SUMMARY = {
  version: DPDP_NOTICE_VERSION,
  fiduciary:
    "Rkyves (operating Cullinos) acts as a data fiduciary for platform account data and as a data processor for tenant restaurant customer/guest data processed on behalf of the organization.",
  purposes: [
    {
      id: DPDP_PURPOSES.ACCOUNT_AUTH,
      label: "Account authentication",
      description: "Send one-time codes and verify your identity to sign in.",
    },
    {
      id: DPDP_PURPOSES.SERVICE,
      label: "Service delivery",
      description: "Fulfil orders, loyalty, and support related to your visit or purchase.",
    },
    {
      id: DPDP_PURPOSES.MARKETING_EMAIL,
      label: "Marketing email",
      description: "Optional promotional emails. You can withdraw consent anytime.",
    },
    {
      id: DPDP_PURPOSES.MARKETING_SMS,
      label: "Marketing SMS",
      description: "Optional promotional SMS. You can withdraw consent anytime.",
    },
    {
      id: DPDP_PURPOSES.HOSPITALITY_ID,
      label: "Hospitality identity verification",
      description: "Government ID details for hotel check-in, encrypted at rest when configured.",
    },
  ],
  rights: [
    "Right to access your personal data",
    "Right to correction",
    "Right to erasure (anonymization where legal/operational records must remain)",
    "Right to withdraw consent for marketing",
    "Right to grievance redressal",
  ],
  grievanceOfficer: {
    name: "Grievance Officer",
    email: "privacy@rkyves.com",
    note: "We aim to acknowledge grievances within 24 hours and resolve within the timelines under applicable DPDP rules.",
  },
  subProcessors: [
    { name: "Neon", purpose: "PostgreSQL database hosting" },
    { name: "Cloudflare", purpose: "CDN, Turnstile bot protection, optional web analytics, object storage (R2)" },
    { name: "MSG91", purpose: "OTP SMS delivery" },
    { name: "Razorpay", purpose: "Payment processing" },
    { name: "Resend / SMTP providers", purpose: "Transactional and promotional email delivery" },
  ],
};

/** Marker prefix for AES-GCM encrypted guest document numbers. */
export const DOCUMENT_ENC_PREFIX = "enc:v1:";

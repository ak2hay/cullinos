import { MARKETING_URLS } from '@cullinos/shared';

export function getSiteUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL ?? MARKETING_URLS.site;
}

export function getRegisterUrl(): string {
  return process.env.NEXT_PUBLIC_REGISTER_URL ?? `${getAdminUrl()}/register`;
}

export function getAdminUrl(): string {
  return process.env.NEXT_PUBLIC_ADMIN_URL ?? MARKETING_URLS.admin;
}

export const SITE_NAME = 'Cullinos';
export const SITE_TAGLINE = 'Restaurant POS & GST Billing Software';
export const SITE_DESCRIPTION =
  'Billing, KOT and online orders in one app. GST-ready restaurant POS for India. 30-day free trial, no card needed. Prices exclude GST.';

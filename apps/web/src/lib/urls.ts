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

export const SITE_NAME = 'Cullinos, by Rkyves';
export const SITE_DEFAULT_TITLE = 'Cullinos POS: Restaurant OS for India | Cullinos, by Rkyves';
export const SITE_DESCRIPTION =
  'Cullinos, by Rkyves: restaurant POS billing, kitchen display (KDS), QR table ordering, live stock, wastage log and recipe-wise food cost for India.';

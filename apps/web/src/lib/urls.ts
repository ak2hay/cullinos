import { MARKETING_URLS } from '@cullinos/shared';

export function getSiteUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL ?? MARKETING_URLS.site;
}

export function getRegisterUrl(): string {
  return process.env.NEXT_PUBLIC_REGISTER_URL ?? `${getSiteUrl()}/contact?intent=trial`;
}

export function getAdminUrl(): string {
  return process.env.NEXT_PUBLIC_ADMIN_URL ?? MARKETING_URLS.admin;
}

export const SITE_NAME = 'Cullinos';
export const SITE_TAGLINE = 'Restaurant Operating System';
export const SITE_DESCRIPTION =
  'Run your restaurant from one place. Menu, orders, inventory, staff, and analytics — unified for modern restaurant operations.';

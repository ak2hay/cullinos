import fs from 'fs';
import path from 'path';

function required(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(`Missing env var ${name}. Copy e2e/.env.example to e2e/.env.local and fill it in.`);
  }
  return value;
}

function optional(primary: string | undefined, fallback: string): string {
  return primary?.trim() || fallback;
}

type RuntimeEnv = {
  orgSlug?: string;
  outletSlug?: string;
  outletId?: string;
  ownerEmail?: string;
  ownerPassword?: string;
  hasTables?: boolean;
  hasMenu?: boolean;
};

function loadRuntimeEnv(): RuntimeEnv {
  const runtimePath = path.join(process.cwd(), 'e2e', '.runtime-env.json');
  if (!fs.existsSync(runtimePath)) return {};
  try {
    return JSON.parse(fs.readFileSync(runtimePath, 'utf8')) as RuntimeEnv;
  } catch {
    return {};
  }
}

const runtime = loadRuntimeEnv();

export const e2eEnv = {
  apiUrl: process.env.E2E_API_URL ?? 'https://api.cullinos.com',
  webUrl: process.env.E2E_WEB_URL ?? 'https://cullinos.com',
  adminUrl: process.env.E2E_ADMIN_URL ?? 'https://admin.cullinos.com',
  managementUrl: process.env.E2E_MANAGEMENT_URL ?? 'https://manage.cullinos.com',
  superAdminUrl: process.env.E2E_SUPER_ADMIN_URL ?? 'https://platform.cullinos.com',
  customerUrl: process.env.E2E_CUSTOMER_URL ?? 'https://order.cullinos.com',
  waiterUrl: process.env.E2E_WAITER_URL ?? 'https://waiter.cullinos.com',
  posUrl: process.env.E2E_POS_URL ?? '',
  kdsUrl: process.env.E2E_KDS_URL ?? '',

  orgSlug: (runtime.orgSlug ?? process.env.E2E_ORG_SLUG?.trim()) || 'demo-restaurant',
  outletSlug: (runtime.outletSlug ?? process.env.E2E_OUTLET_SLUG?.trim()) || 'main-outlet',
  outletId: runtime.outletId ?? process.env.E2E_OUTLET_ID ?? '',

  ownerEmail: runtime.ownerEmail ?? process.env.E2E_OWNER_EMAIL ?? 'e2e-owner@cullinos.com',
  ownerPassword: runtime.ownerPassword ?? process.env.E2E_OWNER_PASSWORD ?? 'E2eTestOwner123!',
  superAdminEmail: process.env.E2E_SUPER_ADMIN_EMAIL ?? 'admin@rkyves.com',
  superAdminPassword: process.env.E2E_SUPER_ADMIN_PASSWORD ?? 'superadmin123',

  waiterEmail: optional(process.env.E2E_WAITER_EMAIL, runtime.ownerEmail ?? process.env.E2E_OWNER_EMAIL ?? 'e2e-owner@cullinos.com'),
  waiterPassword: optional(process.env.E2E_WAITER_PASSWORD, runtime.ownerPassword ?? process.env.E2E_OWNER_PASSWORD ?? 'E2eTestOwner123!'),
  cashierEmail: optional(process.env.E2E_CASHIER_EMAIL, runtime.ownerEmail ?? process.env.E2E_OWNER_EMAIL ?? 'e2e-owner@cullinos.com'),
  cashierPassword: optional(process.env.E2E_CASHIER_PASSWORD, runtime.ownerPassword ?? process.env.E2E_OWNER_PASSWORD ?? 'E2eTestOwner123!'),

  hasTables: runtime.hasTables ?? false,
  hasMenu: runtime.hasMenu ?? false,
  skipPos: process.env.E2E_SKIP_POS !== 'false',
};

export function requireOutletId(): string {
  return required('E2E_OUTLET_ID', e2eEnv.outletId);
}

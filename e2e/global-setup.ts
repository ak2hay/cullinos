import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { API_PREFIX } from './fixtures/api';

dotenv.config({ path: path.resolve(__dirname, '.env.local') });
dotenv.config({ path: path.resolve(__dirname, '.env.example') });

type RuntimeEnv = {
  orgSlug: string;
  outletSlug: string;
  outletId: string;
  ownerEmail: string;
  ownerPassword: string;
  hasTables: boolean;
  hasMenu: boolean;
};

const RUNTIME_ENV_PATH = path.join(process.cwd(), 'e2e', '.runtime-env.json');

async function requestJson<T>(
  url: string,
  options: RequestInit = {},
): Promise<{ ok: boolean; status: number; data: T | null }> {
  const response = await fetch(url, options);
  let data: T | null = null;
  try {
    data = (await response.json()) as T;
  } catch {
    data = null;
  }
  return { ok: response.ok, status: response.status, data };
}

async function superAdminLogin(apiBase: string): Promise<string | null> {
  const email = process.env.E2E_SUPER_ADMIN_EMAIL;
  const password = process.env.E2E_SUPER_ADMIN_PASSWORD;
  if (!email || !password) return null;

  const result = await requestJson<{ accessToken?: string }>(
    `${apiBase}${API_PREFIX}/super-admin/login`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    },
  );

  return result.ok ? (result.data?.accessToken ?? null) : null;
}

async function ownerLogin(
  apiBase: string,
  email: string,
  password: string,
): Promise<{ token: string; organizationId: string } | null> {
  const result = await requestJson<{
    token?: string;
    user?: { organizationId?: string };
  }>(`${apiBase}${API_PREFIX}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });

  if (!result.ok || !result.data?.token || !result.data.user?.organizationId) {
    return null;
  }

  return { token: result.data.token, organizationId: result.data.user.organizationId };
}

async function probeStorefront(
  apiBase: string,
  orgSlug: string,
  outletSlug: string,
): Promise<RuntimeEnv | null> {
  const result = await requestJson<{
    organizationSlug?: string;
    outletSlug?: string;
    outletId?: string;
    menu?: { items?: unknown[] };
  }>(`${apiBase}${API_PREFIX}/storefront/${orgSlug}/${outletSlug}`);

  if (!result.ok || !result.data?.outletId) return null;

  return {
    orgSlug: result.data.organizationSlug ?? orgSlug,
    outletSlug: result.data.outletSlug ?? outletSlug,
    outletId: result.data.outletId,
    ownerEmail: process.env.E2E_OWNER_EMAIL ?? '',
    ownerPassword: process.env.E2E_OWNER_PASSWORD ?? '',
    hasMenu: (result.data.menu?.items?.length ?? 0) > 0,
    hasTables: false,
  };
}

function asArray<T>(value: unknown): T[] {
  if (Array.isArray(value)) return value;
  if (value && typeof value === 'object' && Array.isArray((value as { data?: T[] }).data)) {
    return (value as { data: T[] }).data;
  }
  return [];
}

async function discoverTenant(apiBase: string, token: string): Promise<RuntimeEnv | null> {
  const configuredOrg = process.env.E2E_ORG_SLUG?.trim();
  const configuredOutlet = process.env.E2E_OUTLET_SLUG?.trim() || 'main-outlet';

  if (configuredOrg) {
    const match = await probeStorefront(apiBase, configuredOrg, configuredOutlet);
    if (match) return match;
  }

  const orgsResult = await requestJson<{
    data?: Array<{ slug?: string; isActive?: boolean }>;
  }>(`${apiBase}${API_PREFIX}/super-admin/organizations?page=1&limit=50`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  const orgs = asArray<{ slug?: string; isActive?: boolean }>(
    (orgsResult.data as { data?: unknown } | null)?.data ?? orgsResult.data,
  );

  for (const org of orgs) {
    if (!org.slug || org.isActive === false) continue;
    const match = await probeStorefront(apiBase, org.slug, configuredOutlet);
    if (match) return match;
  }

  const tenantsResult = await requestJson<
    Array<{
      slug?: string;
      status?: string;
      outlets?: Array<{ id?: string; slug?: string; status?: string }>;
    }>
  >(`${apiBase}${API_PREFIX}/super-admin/tenants`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  const tenants = asArray<{
    slug?: string;
    status?: string;
    outlets?: Array<{ id?: string; slug?: string; status?: string }>;
  }>(tenantsResult.data);

  for (const org of tenants) {
    if (!org.slug || !['active', 'trial'].includes(org.status ?? '')) continue;
    const outlet =
      org.outlets?.find((o) => o.slug === configuredOutlet && o.status === 'active') ??
      org.outlets?.find((o) => o.status === 'active');
    if (!outlet?.id) continue;

    const match = await probeStorefront(apiBase, org.slug, outlet.slug ?? configuredOutlet);
    if (match) return match;

    return {
      orgSlug: org.slug,
      outletSlug: outlet.slug ?? configuredOutlet,
      outletId: outlet.id,
      ownerEmail: process.env.E2E_OWNER_EMAIL ?? '',
      ownerPassword: process.env.E2E_OWNER_PASSWORD ?? '',
      hasMenu: false,
      hasTables: false,
    };
  }

  return null;
}

async function provisionTenant(
  apiBase: string,
  token: string,
): Promise<RuntimeEnv | null> {
  if (process.env.E2E_AUTO_PROVISION !== 'true') return null;

  const ownerEmail = process.env.E2E_OWNER_EMAIL ?? 'e2e-owner@cullinos.com';
  const ownerPassword = process.env.E2E_OWNER_PASSWORD ?? 'E2eTestOwner123!';

  const result = await requestJson<{
    organizationSlug?: string;
    outletId?: string;
    ownerEmail?: string;
  }>(`${apiBase}${API_PREFIX}/super-admin/organizations`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      companyName: 'E2E Sandbox Restaurant',
      planSlug: 'professional',
      ownerEmail,
      ownerPassword,
      ownerName: 'E2E Owner',
      outletName: 'Main Outlet',
    }),
  });

  if (!result.ok || !result.data?.organizationSlug || !result.data.outletId) {
    console.warn('[e2e] Auto-provision failed:', result.status, result.data);
    return null;
  }

  return {
    orgSlug: result.data.organizationSlug,
    outletSlug: 'main-outlet',
    outletId: result.data.outletId,
    ownerEmail: result.data.ownerEmail ?? ownerEmail,
    ownerPassword,
    hasMenu: false,
    hasTables: false,
  };
}

async function seedMenuIfNeeded(
  apiBase: string,
  ownerToken: string,
  runtime: RuntimeEnv,
): Promise<boolean> {
  if (runtime.hasMenu) return true;

  const categoryResult = await requestJson<{ id?: string }>(
    `${apiBase}${API_PREFIX}/menu/categories`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${ownerToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ name: 'E2E Mains', slug: 'e2e-mains', sortOrder: 1 }),
    },
  );

  const categoryId = categoryResult.data?.id;
  if (!categoryId) return false;

  const itemResult = await requestJson(
    `${apiBase}${API_PREFIX}/menu/items`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${ownerToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: 'E2E Margherita Pizza',
        slug: 'e2e-margherita',
        categoryId,
        basePrice: 299,
        isVeg: true,
      }),
    },
  );

  if (!itemResult.ok) return false;

  const itemId = (itemResult.data as { id?: string })?.id;
  if (!itemId) return false;

  await requestJson(
    `${apiBase}${API_PREFIX}/menu/outlets/${runtime.outletId}/items/${itemId}/prices`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${ownerToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ price: 299 }),
    },
  );

  return true;
}

async function detectTables(
  apiBase: string,
  outletId: string,
): Promise<boolean> {
  const result = await requestJson<unknown[]>(
    `${apiBase}${API_PREFIX}/public/tables/outlets/${outletId}`,
  );
  return (result.data?.length ?? 0) > 0;
}

export default async function globalSetup() {
  const apiBase = process.env.E2E_API_URL ?? 'https://api.cullinos.com';
  const ownerEmail = process.env.E2E_OWNER_EMAIL ?? 'e2e-owner@cullinos.com';
  const ownerPassword = process.env.E2E_OWNER_PASSWORD ?? 'E2eTestOwner123!';

  if (!process.env.E2E_SUPER_ADMIN_EMAIL) {
    console.warn('[e2e] E2E_SUPER_ADMIN_EMAIL missing — copy e2e/.env.example to e2e/.env.local');
  }

  let runtime: RuntimeEnv | null = null;

  const ownerSession = await ownerLogin(apiBase, ownerEmail, ownerPassword);
  if (ownerSession) {
    const orgSlug = process.env.E2E_ORG_SLUG ?? '';
    const outletSlug = process.env.E2E_OUTLET_SLUG ?? 'main-outlet';
    if (orgSlug) {
      runtime = await probeStorefront(apiBase, orgSlug, outletSlug);
    }
  }

  const superToken = await superAdminLogin(apiBase);
  if (!superToken) {
    console.warn('[e2e] Super admin login failed — check E2E_SUPER_ADMIN_* credentials');
  }
  if (!runtime && superToken) {
    runtime = await discoverTenant(apiBase, superToken);
    if (!runtime) {
      runtime = await provisionTenant(apiBase, superToken);
    }
  }

  if (!runtime) {
    console.warn('[e2e] Could not resolve tenant — browser login tests may fail.');
    fs.writeFileSync(RUNTIME_ENV_PATH, JSON.stringify({}, null, 2));
    return;
  }

  runtime.ownerEmail = ownerEmail;
  runtime.ownerPassword = ownerPassword;

  const ownerToken =
    ownerSession?.token ??
    (await ownerLogin(apiBase, runtime.ownerEmail, runtime.ownerPassword))?.token;

  if (ownerToken) {
    runtime.hasMenu = await seedMenuIfNeeded(apiBase, ownerToken, runtime);
  }

  if (process.env.E2E_OUTLET_ID) {
    runtime.outletId = process.env.E2E_OUTLET_ID;
  }

  runtime.hasTables = await detectTables(apiBase, runtime.outletId);

  fs.writeFileSync(RUNTIME_ENV_PATH, JSON.stringify(runtime, null, 2));
  console.log(
    `[e2e] Tenant ready: ${runtime.orgSlug}/${runtime.outletSlug} (outlet ${runtime.outletId})`,
  );
}

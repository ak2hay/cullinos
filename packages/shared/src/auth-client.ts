export const DEFAULT_API_BASE = 'http://localhost:3000/api/v1';

/**
 * Resolve the Vite SPA API base URL.
 * Dev may fall back to localhost; production must bake `VITE_API_URL` at build time
 * (otherwise Chrome blocks loopback and the UI shows "Failed to fetch").
 */
export function resolveViteApiBase(options: {
  viteApiUrl: string | undefined;
  isProd: boolean;
}): string {
  const trimmed = options.viteApiUrl?.trim();
  if (trimmed) return trimmed;
  if (options.isProd) {
    throw new Error('VITE_API_URL must be set for production builds');
  }
  return DEFAULT_API_BASE;
}

export interface ApiStaffLoginResponse {
  token: string;
  user: {
    id: string;
    email: string;
    name: string;
    organizationId: string;
    organizationName: string;
    organizationSlug?: string;
    isSuperAdmin: boolean;
    mustChangePassword?: boolean;
    firstName?: string;
    lastName?: string;
    phone?: string | null;
    avatarUrl?: string | null;
    isActive?: boolean;
    lastLoginAt?: string | null;
    createdAt?: string;
  };
  accessToken?: string;
  refreshToken?: string;
  expiresIn?: number;
  permissions?: string[];
}

export interface StaffAuthUser {
  id: string;
  organizationId: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  avatarUrl: string | null;
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  mustChangePassword: boolean;
  organizationName?: string;
  organizationSlug?: string;
}

export interface StaffAuthResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  user: StaffAuthUser;
  permissions: string[];
}

export function mapStaffLoginResponse(raw: ApiStaffLoginResponse): StaffAuthResponse {
  if (!raw?.user) {
    throw new Error('Login response missing user');
  }
  const nameParts = (raw.user.name ?? '').trim().split(/\s+/).filter(Boolean);
  return {
    accessToken: raw.accessToken ?? raw.token,
    refreshToken: raw.refreshToken ?? '',
    expiresIn: raw.expiresIn ?? 0,
    user: {
      id: raw.user.id,
      organizationId: raw.user.organizationId,
      email: raw.user.email,
      firstName: raw.user.firstName ?? nameParts[0] ?? '',
      lastName: raw.user.lastName ?? (nameParts.slice(1).join(' ') || ''),
      phone: raw.user.phone ?? null,
      avatarUrl: raw.user.avatarUrl ?? null,
      isActive: raw.user.isActive ?? true,
      lastLoginAt: raw.user.lastLoginAt ?? null,
      createdAt: raw.user.createdAt ?? new Date().toISOString(),
      mustChangePassword: raw.user.mustChangePassword === true,
      organizationName: raw.user.organizationName,
      organizationSlug: raw.user.organizationSlug,
    },
    permissions: raw.permissions ?? [],
  };
}

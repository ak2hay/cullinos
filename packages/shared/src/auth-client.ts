export const DEFAULT_API_BASE = 'http://localhost:3000/api/v1';

export interface ApiStaffLoginResponse {
  token: string;
  user: {
    id: string;
    email: string;
    name: string;
    organizationId: string;
    organizationName: string;
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
}

export interface StaffAuthResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  user: StaffAuthUser;
  permissions: string[];
}

export function mapStaffLoginResponse(raw: ApiStaffLoginResponse): StaffAuthResponse {
  const nameParts = raw.user.name.trim().split(/\s+/);
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
    },
    permissions: raw.permissions ?? [],
  };
}

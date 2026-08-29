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
  };
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
    accessToken: raw.token,
    refreshToken: '',
    expiresIn: 0,
    user: {
      id: raw.user.id,
      organizationId: raw.user.organizationId,
      email: raw.user.email,
      firstName: nameParts[0] ?? '',
      lastName: nameParts.slice(1).join(' ') || '',
      phone: null,
      avatarUrl: null,
      isActive: true,
      lastLoginAt: null,
      createdAt: new Date().toISOString(),
    },
    permissions: raw.permissions ?? [],
  };
}

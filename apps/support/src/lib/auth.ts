import type { ApiStaffLoginResponse } from '@cullinos/shared';
import { useSession, type SessionMode, type SessionUser } from '@/stores/session';
import { apiRequest } from './api';

export type LoginChallenge = { requiresOtp: true; challengeToken: string };

type AgentLoginSuccess = {
  accessToken: string;
  admin: { id: string; email: string; name: string; platformRole?: string; platformPermissions?: string[] };
};

const PATHS: Record<SessionMode, { login: string; verify: string; resend: string }> = {
  agent: { login: '/super-admin/login', verify: '/super-admin/verify-otp', resend: '/super-admin/resend-otp' },
  customer: { login: '/auth/login', verify: '/auth/verify-otp', resend: '/auth/resend-otp' },
};

function toSession(mode: SessionMode, raw: AgentLoginSuccess | ApiStaffLoginResponse): { accessToken: string; user: SessionUser } {
  if (mode === 'agent') {
    const r = raw as AgentLoginSuccess;
    return {
      accessToken: r.accessToken,
      user: {
        id: r.admin.id,
        name: r.admin.name,
        email: r.admin.email,
        platformRole: r.admin.platformRole,
        platformPermissions: r.admin.platformPermissions ?? [],
      },
    };
  }
  const r = raw as ApiStaffLoginResponse;
  if (r.user.isSuperAdmin) {
    throw new Error('This is a Rkyves staff account. Choose "Rkyves staff" to sign in.');
  }
  return {
    accessToken: r.accessToken ?? r.token,
    user: {
      id: r.user.id,
      name: r.user.name,
      email: r.user.email,
      organizationId: r.user.organizationId,
      organizationName: r.user.organizationName,
    },
  };
}

function finish(mode: SessionMode, raw: AgentLoginSuccess | ApiStaffLoginResponse) {
  const s = toSession(mode, raw);
  useSession.getState().setSession({ mode, ...s });
}

export async function login(
  mode: SessionMode,
  payload: { email: string; password: string; captchaToken?: string },
): Promise<LoginChallenge | null> {
  const raw = await apiRequest<LoginChallenge | AgentLoginSuccess | ApiStaffLoginResponse>(
    PATHS[mode].login,
    { method: 'POST', body: JSON.stringify(payload), session: mode },
    false,
  );
  if ('requiresOtp' in raw && raw.requiresOtp) return raw;
  finish(mode, raw as AgentLoginSuccess | ApiStaffLoginResponse);
  return null;
}

export async function verifyOtp(mode: SessionMode, payload: { challengeToken: string; otp: string }) {
  const raw = await apiRequest<AgentLoginSuccess | ApiStaffLoginResponse>(
    PATHS[mode].verify,
    { method: 'POST', body: JSON.stringify(payload), session: mode },
    false,
  );
  finish(mode, raw);
}

export function resendOtp(mode: SessionMode, challengeToken: string) {
  return apiRequest<LoginChallenge>(
    PATHS[mode].resend,
    { method: 'POST', body: JSON.stringify({ challengeToken }), session: mode },
    false,
  );
}

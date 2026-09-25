/** Tenant environment: 0 = Sandbox (QA/demo), 1 = Live (real customers). */
export const TENANT_ENV_SANDBOX = 0;
export const TENANT_ENV_LIVE = 1;

export type SandboxOrgFlags = {
  environmentClass?: number;
  sandboxSkipEmailOtp?: boolean;
  sandboxSkipSmsOtp?: boolean;
  sandboxRelaxPassword?: boolean;
};

export function isSandboxTenant(
  org: Pick<SandboxOrgFlags, "environmentClass"> | null | undefined,
): boolean {
  return org != null && Number(org.environmentClass) === TENANT_ENV_SANDBOX;
}

/**
 * @deprecated OTP skip is controlled by sandbox org flags only.
 * Kept for callers/tests that still pass an env argument; always returns true.
 */
export function sandboxOtpSkipPermittedByRuntime(
  _env: NodeJS.ProcessEnv = process.env,
): boolean {
  return true;
}

export function sandboxAllowsEmailOtpSkip(
  org: SandboxOrgFlags | null | undefined,
  _env: NodeJS.ProcessEnv = process.env,
): boolean {
  return isSandboxTenant(org) && org!.sandboxSkipEmailOtp === true;
}

export function sandboxAllowsSmsOtpSkip(
  org: SandboxOrgFlags | null | undefined,
  _env: NodeJS.ProcessEnv = process.env,
): boolean {
  return isSandboxTenant(org) && org!.sandboxSkipSmsOtp === true;
}

export function sandboxAllowsRelaxedPassword(
  org: SandboxOrgFlags | null | undefined,
): boolean {
  return isSandboxTenant(org) && org!.sandboxRelaxPassword === true;
}

/** Min password length: 6 for sandbox relax, else 8. */
export function passwordMinLength(
  org: SandboxOrgFlags | null | undefined,
): number {
  return sandboxAllowsRelaxedPassword(org) ? 6 : 8;
}

export function assertPasswordLength(
  password: string,
  org: SandboxOrgFlags | null | undefined,
): string | null {
  const min = passwordMinLength(org);
  if (password.length < min || password.length > 128) {
    return `New password must be ${min}–128 characters`;
  }
  return null;
}

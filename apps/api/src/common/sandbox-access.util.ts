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
 * OTP skip is fail-closed in production: a sandbox tenant on a production API only skips
 * OTP when the operator explicitly sets ALLOW_SANDBOX_OTP_SKIP=true on that deployment.
 */
export function sandboxOtpSkipPermittedByRuntime(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  if (env.NODE_ENV !== "production") return true;
  return (env.ALLOW_SANDBOX_OTP_SKIP ?? "").trim().toLowerCase() === "true";
}

export function sandboxAllowsEmailOtpSkip(
  org: SandboxOrgFlags | null | undefined,
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  return (
    isSandboxTenant(org) &&
    org!.sandboxSkipEmailOtp === true &&
    sandboxOtpSkipPermittedByRuntime(env)
  );
}

export function sandboxAllowsSmsOtpSkip(
  org: SandboxOrgFlags | null | undefined,
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  return (
    isSandboxTenant(org) &&
    org!.sandboxSkipSmsOtp === true &&
    sandboxOtpSkipPermittedByRuntime(env)
  );
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

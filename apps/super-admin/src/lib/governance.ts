import { create } from 'zustand';

/**
 * Bridges API-level governance prompts (approval justification, step-up OTP) to the
 * dialogs mounted in the AppShell, so any request can pause, ask, and retry.
 */
type JustificationPrompt = { kind: 'justification'; message: string; resolve: (v: { justification: string; ticketId?: string } | null) => void };
type StepUpPrompt = { kind: 'step_up'; message: string; resolve: (token: string | null) => void };
type Prompt = JustificationPrompt | StepUpPrompt;

export type ApprovalNotice = { id: string; ref: string; title: string; message: string };

interface GovernanceState {
  prompt: Prompt | null;
  notice: ApprovalNotice | null;
  setPrompt: (p: Prompt | null) => void;
  setNotice: (n: ApprovalNotice | null) => void;
}

export const useGovernanceStore = create<GovernanceState>()((set) => ({
  prompt: null,
  notice: null,
  setPrompt: (prompt) => set({ prompt }),
  setNotice: (notice) => set({ notice }),
}));

let queue: Promise<unknown> = Promise.resolve();

/** Prompts are shown one at a time even if several requests need one concurrently. */
function enqueue<T>(open: (resolve: (v: T) => void) => void): Promise<T> {
  const next = queue.then(
    () =>
      new Promise<T>((resolve) => {
        open((v) => {
          useGovernanceStore.getState().setPrompt(null);
          resolve(v);
        });
      }),
  );
  queue = next.catch(() => undefined);
  return next;
}

export function askJustification(message: string) {
  return enqueue<{ justification: string; ticketId?: string } | null>((resolve) =>
    useGovernanceStore.getState().setPrompt({ kind: 'justification', message, resolve }),
  );
}

export function askStepUp(message: string) {
  return enqueue<string | null>((resolve) =>
    useGovernanceStore.getState().setPrompt({ kind: 'step_up', message, resolve }),
  );
}

export function showApprovalNotice(notice: ApprovalNotice) {
  useGovernanceStore.getState().setNotice(notice);
}

/** Short-lived step-up token reused for consecutive critical actions. */
let stepUp: { token: string; expiresAt: number } | null = null;

export function cachedStepUpToken() {
  return stepUp && stepUp.expiresAt > Date.now() ? stepUp.token : null;
}

export function rememberStepUpToken(token: string, ttlSeconds = 240) {
  stepUp = { token, expiresAt: Date.now() + ttlSeconds * 1000 };
}

export function clearStepUpToken() {
  stepUp = null;
}

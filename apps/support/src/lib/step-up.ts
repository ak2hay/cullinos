import { create } from 'zustand';

/** Bridges the API's STEP_UP_REQUIRED response to the dialog mounted in the agent shell. */
type StepUpPrompt = { message: string; resolve: (token: string | null) => void };

export const useStepUpStore = create<{ prompt: StepUpPrompt | null; setPrompt: (p: StepUpPrompt | null) => void }>()(
  (set) => ({
    prompt: null,
    setPrompt: (prompt) => set({ prompt }),
  }),
);

let pending: Promise<string | null> | null = null;

export function askStepUp(message: string): Promise<string | null> {
  if (pending) return pending;
  pending = new Promise<string | null>((resolve) => {
    useStepUpStore.getState().setPrompt({
      message,
      resolve: (token) => {
        useStepUpStore.getState().setPrompt(null);
        pending = null;
        resolve(token);
      },
    });
  });
  return pending;
}

let cached: { token: string; expiresAt: number } | null = null;

export function cachedStepUpToken() {
  return cached && cached.expiresAt > Date.now() ? cached.token : null;
}

export function rememberStepUpToken(token: string, ttlSeconds = 240) {
  cached = { token, expiresAt: Date.now() + ttlSeconds * 1000 };
}

export function clearStepUpToken() {
  cached = null;
}

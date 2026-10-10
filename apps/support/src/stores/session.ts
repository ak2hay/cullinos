import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

/** `agent` = Rkyves platform staff (super-admin JWT); `customer` = restaurant user (org JWT). */
export type SessionMode = 'agent' | 'customer';

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  organizationId?: string;
  organizationName?: string;
  platformRole?: string;
  platformPermissions?: string[];
}

interface SessionState {
  mode: SessionMode | null;
  accessToken: string | null;
  user: SessionUser | null;
  setSession: (s: { mode: SessionMode; accessToken: string; user: SessionUser }) => void;
  setToken: (accessToken: string) => void;
  logout: () => void;
}

export const useSession = create<SessionState>()(
  persist(
    (set) => ({
      mode: null,
      accessToken: null,
      user: null,
      setSession: ({ mode, accessToken, user }) => set({ mode, accessToken, user }),
      setToken: (accessToken) => set({ accessToken }),
      logout: () => set({ mode: null, accessToken: null, user: null }),
    }),
    {
      name: 'cullinos-support-session',
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ mode: s.mode, accessToken: s.accessToken, user: s.user }),
    },
  ),
);

export function useCanAgent() {
  const user = useSession((s) => s.user);
  const perms = user?.platformPermissions ?? [];
  return (perm: string) => user?.platformRole === 'owner' || perms.includes(perm);
}

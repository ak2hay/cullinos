import { create } from 'zustand';

interface PortalState {
  /** Set when super admin has switched the Management portal off. */
  disabledMessage: string | null;
  setDisabled: (message: string | null) => void;
}

export const usePortalStore = create<PortalState>()((set) => ({
  disabledMessage: null,
  setDisabled: (message) => set({ disabledMessage: message }),
}));

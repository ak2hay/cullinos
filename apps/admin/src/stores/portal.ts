import { create } from 'zustand';

interface PortalState {
  /** Set when super admin has switched the portal off. */
  disabledMessage: string | null;
  /** Set when portal is in maintenance (distinct from disabled). */
  maintenanceMessage: string | null;
  setDisabled: (message: string | null) => void;
  setMaintenance: (message: string | null) => void;
  clearBlocks: () => void;
}

export const usePortalStore = create<PortalState>()((set) => ({
  disabledMessage: null,
  maintenanceMessage: null,
  setDisabled: (message) => set({ disabledMessage: message, maintenanceMessage: null }),
  setMaintenance: (message) => set({ maintenanceMessage: message, disabledMessage: null }),
  clearBlocks: () => set({ disabledMessage: null, maintenanceMessage: null }),
}));

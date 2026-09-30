import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/** `"default"` = tickets not routed to any station (main kitchen). */
interface KdsUiState {
  selectedStationId: string | null;
  setSelectedStationId: (id: string | null) => void;
}

/** Persisted so a screen mounted at one station keeps showing it after reloads. */
export const useKdsStore = create<KdsUiState>()(
  persist(
    (set) => ({
      selectedStationId: null,
      setSelectedStationId: (id) => set({ selectedStationId: id }),
    }),
    { name: 'cullinos-kds-station' },
  ),
);

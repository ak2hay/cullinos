import { create } from 'zustand';

interface KdsUiState {
  selectedStationId: string | null;
  setSelectedStationId: (id: string | null) => void;
}

export const useKdsStore = create<KdsUiState>((set) => ({
  selectedStationId: null,
  setSelectedStationId: (id) => set({ selectedStationId: id }),
}));

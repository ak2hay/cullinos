import { create } from 'zustand';
export const useKdsStore = create((set) => ({
    selectedStationId: null,
    setSelectedStationId: (id) => set({ selectedStationId: id }),
}));

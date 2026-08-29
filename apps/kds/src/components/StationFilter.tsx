import { useKdsStore } from '@/stores/kds';
import type { KitchenDisplayData } from '@/lib/api';

interface StationFilterProps {
  displayData: KitchenDisplayData;
}

export function StationFilter({ displayData }: StationFilterProps) {
  const selectedStationId = useKdsStore((s) => s.selectedStationId);
  const setSelectedStationId = useKdsStore((s) => s.setSelectedStationId);

  const stations = displayData.stations.map((s) => s.station);

  return (
    <select
      value={selectedStationId ?? ''}
      onChange={(e) => setSelectedStationId(e.target.value || null)}
      className="h-10 rounded-lg border border-white/10 bg-bg-card px-3 text-sm text-text-primary outline-none focus:border-brand-primary"
    >
      <option value="">All stations</option>
      {stations.map((station) => (
        <option key={station.id} value={station.id}>
          {station.name}
        </option>
      ))}
    </select>
  );
}

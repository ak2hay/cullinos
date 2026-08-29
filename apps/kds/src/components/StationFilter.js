import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useKdsStore } from '@/stores/kds';
export function StationFilter({ displayData }) {
    const selectedStationId = useKdsStore((s) => s.selectedStationId);
    const setSelectedStationId = useKdsStore((s) => s.setSelectedStationId);
    const stations = displayData.stations.map((s) => s.station);
    return (_jsxs("select", { value: selectedStationId ?? '', onChange: (e) => setSelectedStationId(e.target.value || null), className: "h-10 rounded-lg border border-white/10 bg-bg-card px-3 text-sm text-text-primary outline-none focus:border-brand-primary", children: [_jsx("option", { value: "", children: "All stations" }), stations.map((station) => (_jsx("option", { value: station.id, children: station.name }, station.id)))] }));
}

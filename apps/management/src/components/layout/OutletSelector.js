import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';
import { outletsApi } from '@/lib/api';
import { useAuthStore } from '@/stores/auth';
export function OutletSelector() {
    const selectedBrandId = useAuthStore((s) => s.selectedBrandId);
    const selectedOutletId = useAuthStore((s) => s.selectedOutletId);
    const setSelectedOutlet = useAuthStore((s) => s.setSelectedOutlet);
    const { data: outlets = [], isLoading } = useQuery({
        queryKey: ['outlets', selectedBrandId],
        queryFn: () => outletsApi.list(selectedBrandId ?? undefined),
    });
    useEffect(() => {
        if (!selectedOutletId && outlets.length > 0) {
            setSelectedOutlet(outlets[0].id);
        }
    }, [outlets, selectedOutletId, setSelectedOutlet]);
    if (isLoading) {
        return _jsx("div", { className: "h-9 w-44 animate-pulse rounded-lg bg-bg-elevated" });
    }
    if (outlets.length === 0) {
        return _jsx("span", { className: "text-sm text-text-muted", children: "No outlets" });
    }
    return (_jsxs("select", { value: selectedOutletId ?? '', onChange: (e) => setSelectedOutlet(e.target.value || null), className: "h-9 rounded-lg border border-white/10 bg-bg-elevated px-3 text-sm text-text-primary outline-none focus:border-brand-primary", children: [_jsx("option", { value: "", children: "All outlets" }), outlets.map((outlet) => (_jsxs("option", { value: outlet.id, children: [outlet.name, outlet.city ? ` · ${outlet.city}` : ''] }, outlet.id)))] }));
}

import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useMutation, useQueries, useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { TableCard } from '@/components/TableCard';
import { Button } from '@/components/ui/Form';
import { ordersApi, outletsApi, tablesApi } from '@/lib/api';
import { useAuthStore } from '@/stores/auth';
export function TablesPage() {
    const navigate = useNavigate();
    const outletId = useAuthStore((s) => s.selectedOutletId);
    const setSelectedOutlet = useAuthStore((s) => s.setSelectedOutlet);
    const { data: outlets = [] } = useQuery({
        queryKey: ['outlets'],
        queryFn: outletsApi.list,
    });
    const { data: tables = [], isLoading, refetch } = useQuery({
        queryKey: ['tables', outletId],
        queryFn: () => tablesApi.list(outletId),
        enabled: Boolean(outletId),
    });
    const orderQueries = useQueries({
        queries: tables.map((table) => ({
            queryKey: ['table-orders', table.id],
            queryFn: () => ordersApi.list({
                outletId: outletId,
                tableId: table.id,
                status: 'CONFIRMED',
            }),
            enabled: Boolean(outletId),
            staleTime: 15_000,
        })),
    });
    const orderCountByTable = useMemo(() => {
        const map = new Map();
        tables.forEach((table, i) => {
            const result = orderQueries[i]?.data;
            map.set(table.id, result?.data?.length ?? 0);
        });
        return map;
    }, [tables, orderQueries]);
    const assignMutation = useMutation({
        mutationFn: (tableId) => tablesApi.updateStatus(outletId, tableId, 'OCCUPIED'),
        onSuccess: () => void refetch(),
    });
    return (_jsxs("div", { className: "p-4", children: [_jsxs("div", { className: "mb-4", children: [_jsx("label", { htmlFor: "outlet", className: "mb-1 block text-xs font-medium text-text-secondary", children: "Outlet" }), _jsxs("select", { id: "outlet", value: outletId ?? '', onChange: (e) => setSelectedOutlet(e.target.value || null), className: "h-10 w-full rounded-lg border border-white/10 bg-bg-card px-3 text-sm outline-none focus:border-brand-primary", children: [_jsx("option", { value: "", children: "Select outlet" }), outlets.filter((o) => o.isActive).map((o) => (_jsx("option", { value: o.id, children: o.name }, o.id)))] })] }), !outletId ? (_jsx("p", { className: "py-12 text-center text-text-secondary", children: "Select an outlet to view tables." })) : isLoading ? (_jsx("p", { className: "py-12 text-center text-text-secondary", children: "Loading tables\u2026" })) : tables.length === 0 ? (_jsx("p", { className: "py-12 text-center text-text-secondary", children: "No tables configured." })) : (_jsx("div", { className: "grid grid-cols-2 gap-3 sm:grid-cols-3", children: tables.map((table) => (_jsxs("div", { className: "flex flex-col gap-2", children: [_jsx(TableCard, { table: table, activeOrderCount: orderCountByTable.get(table.id) ?? 0, onSelect: () => navigate(`/order/${table.id}`) }), table.status === 'AVAILABLE' ? (_jsx(Button, { variant: "secondary", size: "sm", loading: assignMutation.isPending, onClick: () => assignMutation.mutate(table.id), children: "Assign table" })) : null] }, table.id))) }))] }));
}

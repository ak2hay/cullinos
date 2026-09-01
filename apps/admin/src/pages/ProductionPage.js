import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Button, Input } from '@/components/ui/Form';
import { outletsApi, productionApi } from '@/lib/api';
export function ProductionPage() {
    const queryClient = useQueryClient();
    const [form, setForm] = useState({
        name: '',
        plannedQty: '24',
        scheduledFor: '',
        batchNumber: '',
    });
    const outletsQuery = useQuery({ queryKey: ['outlets'], queryFn: outletsApi.list });
    const outletId = outletsQuery.data?.[0]?.id;
    const batchesQuery = useQuery({
        queryKey: ['production', outletId],
        queryFn: () => productionApi.list(outletId),
        enabled: Boolean(outletId),
    });
    const createMutation = useMutation({
        mutationFn: () => productionApi.create({
            outletId,
            name: form.name,
            plannedQty: Number(form.plannedQty),
            batchNumber: form.batchNumber || undefined,
            scheduledFor: new Date(form.scheduledFor).toISOString(),
        }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['production'] });
            setForm({ name: '', plannedQty: '24', scheduledFor: '', batchNumber: '' });
        },
    });
    const completeMutation = useMutation({
        mutationFn: (id) => productionApi.complete(id),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['production'] }),
    });
    return (_jsxs("div", { className: "space-y-6", children: [_jsxs("div", { children: [_jsx("h1", { className: "text-2xl font-semibold", children: "Production" }), _jsx("p", { className: "text-sm text-text-secondary", children: "Daily bake sheets, batch planning, and stock deduction." })] }), _jsxs("div", { className: "grid gap-3 rounded-xl border border-white/5 bg-bg-card p-4 sm:grid-cols-2", children: [_jsx(Input, { label: "Batch name", placeholder: "Morning sourdough", value: form.name, onChange: (e) => setForm({ ...form, name: e.target.value }) }), _jsx(Input, { label: "Planned qty", placeholder: "24", value: form.plannedQty, onChange: (e) => setForm({ ...form, plannedQty: e.target.value }) }), _jsx(Input, { label: "Scheduled for", type: "datetime-local", value: form.scheduledFor, onChange: (e) => setForm({ ...form, scheduledFor: e.target.value }) }), _jsx(Input, { label: "Batch number", placeholder: "BATCH-001", value: form.batchNumber, onChange: (e) => setForm({ ...form, batchNumber: e.target.value }) }), _jsx(Button, { onClick: () => createMutation.mutate(), disabled: !form.name || !form.scheduledFor, children: "Schedule batch" })] }), _jsx("div", { className: "space-y-2", children: (batchesQuery.data ?? []).map((batch) => (_jsxs("div", { className: "flex items-center justify-between rounded-lg border border-white/5 bg-bg-card p-4", children: [_jsxs("div", { children: [_jsx("p", { className: "font-medium", children: String(batch.name) }), _jsxs("p", { className: "text-sm text-text-muted", children: ["Qty ", String(batch.plannedQty), " \u00B7 ", String(batch.status)] })] }), batch.status !== 'completed' ? (_jsx(Button, { onClick: () => completeMutation.mutate(String(batch.id)), children: "Complete" })) : null] }, String(batch.id)))) })] }));
}

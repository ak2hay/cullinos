import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Button, Input } from '@/components/ui/Form';
import { eventsApi, outletsApi } from '@/lib/api';
export function EventsPage() {
    const queryClient = useQueryClient();
    const [outletId, setOutletId] = useState('');
    const [form, setForm] = useState({
        name: '',
        location: '',
        eventDate: '',
        startTime: '11:00',
        endTime: '15:00',
    });
    const outletsQuery = useQuery({ queryKey: ['outlets'], queryFn: outletsApi.list });
    const eventsQuery = useQuery({
        queryKey: ['events', outletId],
        queryFn: () => eventsApi.list(outletId || undefined),
        enabled: Boolean(outletId || outletsQuery.data?.length),
    });
    const createMutation = useMutation({
        mutationFn: () => eventsApi.create({
            outletId: outletId || outletsQuery.data?.[0]?.id,
            ...form,
            eventDate: new Date(form.eventDate).toISOString(),
        }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['events'] });
            setForm({ name: '', location: '', eventDate: '', startTime: '11:00', endTime: '15:00' });
        },
    });
    return (_jsxs("div", { className: "space-y-6", children: [_jsxs("div", { children: [_jsx("h1", { className: "text-2xl font-semibold", children: "Events & Locations" }), _jsx("p", { className: "text-sm text-text-secondary", children: "Schedule food truck stops and pop-up locations." })] }), _jsxs("select", { value: outletId, onChange: (e) => setOutletId(e.target.value), className: "rounded-lg border border-white/10 bg-bg-primary px-3 py-2 text-sm", children: [_jsx("option", { value: "", children: "All outlets" }), (outletsQuery.data ?? []).map((o) => (_jsx("option", { value: o.id, children: o.name }, o.id)))] }), _jsxs("div", { className: "grid gap-3 rounded-xl border border-white/5 bg-bg-card p-4 sm:grid-cols-2", children: [_jsx(Input, { label: "Event name", placeholder: "Weekend market", value: form.name, onChange: (e) => setForm({ ...form, name: e.target.value }) }), _jsx(Input, { label: "Location", placeholder: "BKC, Mumbai", value: form.location, onChange: (e) => setForm({ ...form, location: e.target.value }) }), _jsx(Input, { label: "Event date", type: "date", value: form.eventDate, onChange: (e) => setForm({ ...form, eventDate: e.target.value }) }), _jsxs("div", { className: "flex gap-2", children: [_jsx(Input, { label: "Start time", value: form.startTime, onChange: (e) => setForm({ ...form, startTime: e.target.value }) }), _jsx(Input, { label: "End time", value: form.endTime, onChange: (e) => setForm({ ...form, endTime: e.target.value }) })] }), _jsx(Button, { onClick: () => createMutation.mutate(), disabled: !form.name || !form.eventDate, children: "Add event" })] }), _jsx("div", { className: "space-y-2", children: (eventsQuery.data ?? []).map((event) => (_jsxs("div", { className: "rounded-lg border border-white/5 bg-bg-card p-4", children: [_jsx("p", { className: "font-medium", children: String(event.name) }), _jsx("p", { className: "text-sm text-text-muted", children: String(event.location ?? '') }), _jsxs("p", { className: "text-xs text-text-muted", children: [new Date(String(event.eventDate)).toLocaleDateString(), " \u00B7 ", String(event.startTime), "\u2013", String(event.endTime)] })] }, String(event.id)))) })] }));
}

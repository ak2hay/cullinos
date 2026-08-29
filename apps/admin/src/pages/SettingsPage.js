import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/Form';
import { settingsApi } from '@/lib/api';
export function SettingsPage() {
    const queryClient = useQueryClient();
    const [jsonText, setJsonText] = useState('{}');
    const [parseError, setParseError] = useState('');
    const { data, isLoading, error } = useQuery({
        queryKey: ['settings'],
        queryFn: settingsApi.get,
    });
    useEffect(() => {
        if (data?.settings) {
            setJsonText(JSON.stringify(data.settings, null, 2));
        }
    }, [data]);
    const saveMutation = useMutation({
        mutationFn: settingsApi.update,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['settings'] });
        },
    });
    function handleSave() {
        setParseError('');
        try {
            const parsed = JSON.parse(jsonText);
            saveMutation.mutate(parsed);
        }
        catch {
            setParseError('Invalid JSON. Please fix formatting before saving.');
        }
    }
    return (_jsxs("div", { className: "mx-auto max-w-3xl space-y-6", children: [_jsxs("div", { children: [_jsx("h1", { className: "text-2xl font-semibold", children: "Settings" }), _jsx("p", { className: "mt-1 text-sm text-text-secondary", children: "Organization-wide configuration stored as JSON." })] }), error ? (_jsx("div", { className: "rounded-xl border border-status-error/30 bg-status-error/10 px-4 py-3 text-sm text-status-error", children: error instanceof Error ? error.message : 'Failed to load settings' })) : null, saveMutation.isSuccess ? (_jsx("div", { className: "rounded-xl border border-status-success/30 bg-status-success/10 px-4 py-3 text-sm text-status-success", children: "Settings saved successfully." })) : null, _jsxs("div", { className: "rounded-xl border border-white/5 bg-bg-card p-5", children: [_jsx("label", { htmlFor: "settings-json", className: "block text-sm font-medium text-text-secondary", children: "Organization settings (JSON)" }), isLoading ? (_jsx("div", { className: "mt-4 h-64 animate-pulse rounded-lg bg-bg-elevated" })) : (_jsx("textarea", { id: "settings-json", rows: 16, value: jsonText, onChange: (e) => setJsonText(e.target.value), className: "mt-3 w-full rounded-lg border border-white/10 bg-bg-elevated p-4 font-mono text-sm text-text-primary outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20" })), parseError ? (_jsx("p", { className: "mt-2 text-sm text-status-error", children: parseError })) : null, _jsx("div", { className: "mt-4 flex gap-2", children: _jsx(Button, { onClick: handleSave, loading: saveMutation.isPending, children: "Save settings" }) })] })] }));
}

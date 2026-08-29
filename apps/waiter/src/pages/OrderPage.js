import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { QuickAddBar } from '@/components/MenuQuickAdd';
import { Button } from '@/components/ui/Form';
import { menuApi, ordersApi, posApi, tablesApi } from '@/lib/api';
import { useAuthStore } from '@/stores/auth';
export function OrderPage() {
    const { tableId } = useParams();
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const outletId = useAuthStore((s) => s.selectedOutletId);
    const { data: table } = useQuery({
        queryKey: ['table', tableId],
        queryFn: async () => {
            const tables = await tablesApi.list(outletId);
            return tables.find((t) => t.id === tableId);
        },
        enabled: Boolean(outletId && tableId),
    });
    const { data: ordersResult, refetch: refetchOrders } = useQuery({
        queryKey: ['table-orders-detail', tableId],
        queryFn: () => ordersApi.list({
            outletId: outletId,
            tableId: tableId,
        }),
        enabled: Boolean(outletId && tableId),
    });
    const activeOrder = ordersResult?.data?.find((o) => !['COMPLETED', 'CANCELLED'].includes(o.status));
    const { data: orderDetail, refetch: refetchOrderDetail } = useQuery({
        queryKey: ['order', activeOrder?.id],
        queryFn: () => ordersApi.get(activeOrder.id),
        enabled: Boolean(activeOrder?.id),
    });
    const { data: menu } = useQuery({
        queryKey: ['menu', outletId],
        queryFn: () => menuApi.getOutletMenu(outletId),
        enabled: Boolean(outletId),
    });
    const invalidate = () => {
        void queryClient.invalidateQueries({ queryKey: ['table-orders-detail', tableId] });
        void queryClient.invalidateQueries({ queryKey: ['tables', outletId] });
        void refetchOrders();
        void refetchOrderDetail();
    };
    const createOrderMutation = useMutation({
        mutationFn: (items) => ordersApi.create({
            outletId: outletId,
            source: 'WAITER',
            tableId: tableId,
            items,
        }),
        onSuccess: invalidate,
    });
    const addItemsMutation = useMutation({
        mutationFn: (items) => ordersApi.addItems(activeOrder.id, items),
        onSuccess: invalidate,
    });
    const confirmMutation = useMutation({
        mutationFn: () => ordersApi.confirm(activeOrder.id),
        onSuccess: invalidate,
    });
    const quickOrderMutation = useMutation({
        mutationFn: (items) => posApi.quickOrder({
            outletId: outletId,
            tableId: tableId,
            items,
            autoConfirm: true,
        }),
        onSuccess: invalidate,
    });
    const statusMutation = useMutation({
        mutationFn: (status) => tablesApi.updateStatus(outletId, tableId, status),
        onSuccess: invalidate,
    });
    const assignMutation = useMutation({
        mutationFn: () => tablesApi.updateStatus(outletId, tableId, 'OCCUPIED'),
        onSuccess: invalidate,
    });
    async function handleQuickAdd(items) {
        if (activeOrder) {
            await addItemsMutation.mutateAsync(items);
        }
        else {
            await quickOrderMutation.mutateAsync(items);
        }
    }
    const isBusy = createOrderMutation.isPending ||
        addItemsMutation.isPending ||
        quickOrderMutation.isPending;
    if (!outletId || !tableId) {
        return (_jsx("div", { className: "p-4 text-center text-text-secondary", children: "Missing outlet or table." }));
    }
    return (_jsxs("div", { className: "flex min-h-full flex-col", children: [_jsxs("div", { className: "border-b border-white/10 p-4", children: [_jsx("button", { type: "button", onClick: () => navigate('/'), className: "mb-2 text-sm text-brand-primary", children: "\u2190 Back to tables" }), _jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("div", { children: [_jsx("h1", { className: "text-xl font-semibold", children: table?.name ?? 'Table' }), _jsxs("p", { className: "text-sm text-text-secondary", children: [table?.status ?? '—', " \u00B7 ", table?.capacity ?? 0, " seats"] })] }), table?.status === 'AVAILABLE' ? (_jsx(Button, { variant: "secondary", size: "sm", loading: assignMutation.isPending, onClick: () => assignMutation.mutate(), children: "Assign table" })) : (_jsx("div", { className: "flex flex-wrap gap-2", children: ['BILLING', 'CLEANING', 'AVAILABLE'].map((status) => (_jsx(Button, { variant: "secondary", size: "sm", loading: statusMutation.isPending, onClick: () => statusMutation.mutate(status), children: status.charAt(0) + status.slice(1).toLowerCase() }, status))) }))] })] }), _jsx("div", { className: "flex-1 p-4", children: activeOrder ? (_jsxs("div", { className: "space-y-4", children: [_jsxs("div", { className: "rounded-xl border border-white/10 bg-bg-card p-4", children: [_jsxs("div", { className: "mb-3 flex items-center justify-between", children: [_jsxs("span", { className: "font-mono text-brand-primary", children: ["#", activeOrder.orderNumber] }), _jsx("span", { className: "rounded-full bg-status-preparing/20 px-2 py-0.5 text-xs font-medium text-status-preparing", children: activeOrder.status })] }), _jsxs("ul", { className: "space-y-2", children: [(orderDetail?.items ?? []).map((item) => (_jsxs("li", { className: "flex justify-between text-sm", children: [_jsxs("span", { children: [item.quantity, "\u00D7 ", item.name] }), _jsxs("span", { className: "text-text-secondary", children: ["\u20B9", ((item.unitPrice * item.quantity) / 100).toFixed(0)] })] }, item.id))), (orderDetail?.items ?? []).length === 0 ? (_jsx("li", { className: "text-sm text-text-muted", children: "No items yet" })) : null] }), _jsxs("div", { className: "mt-3 flex justify-between border-t border-white/10 pt-3 text-sm font-medium", children: [_jsx("span", { children: "Subtotal" }), _jsxs("span", { className: "text-brand-primary", children: ["\u20B9", ((orderDetail?.subtotal ?? activeOrder.subtotal) / 100).toFixed(0)] })] })] }), activeOrder.status === 'DRAFT' ? (_jsx(Button, { className: "w-full", loading: confirmMutation.isPending, onClick: () => confirmMutation.mutate(), children: "Confirm order" })) : null] })) : (_jsxs("div", { className: "rounded-xl border border-dashed border-white/20 p-8 text-center", children: [_jsx("p", { className: "text-text-secondary", children: "No active order for this table." }), _jsx("p", { className: "mt-1 text-sm text-text-muted", children: "Use quick add below to start an order." })] })) }), menu ? (_jsx(QuickAddBar, { items: menu.items, loading: isBusy, onQuickAdd: handleQuickAdd })) : null] }));
}

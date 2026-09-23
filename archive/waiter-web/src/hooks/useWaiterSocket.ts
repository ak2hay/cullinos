import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { io, type Socket } from 'socket.io-client';
import { useAuthStore } from '@/stores/auth';

const WS_URL = import.meta.env.VITE_WS_URL ?? 'http://localhost:3000';

export function useWaiterSocket() {
  const queryClient = useQueryClient();
  const outletId = useAuthStore((s) => s.selectedOutletId);
  const accessToken = useAuthStore((s) => s.accessToken);
  const [latestCall, setLatestCall] = useState<{
    tableName: string;
    at: number;
  } | null>(null);

  useEffect(() => {
    if (!outletId || !accessToken) return;

    const socket: Socket = io(WS_URL, {
      transports: ['websocket', 'polling'],
      auth: { token: accessToken },
    });

    const invalidate = () => {
      void queryClient.invalidateQueries({ queryKey: ['tables', outletId] });
      void queryClient.invalidateQueries({ queryKey: ['table-orders'] });
      void queryClient.invalidateQueries({ queryKey: ['table-orders-detail'] });
      void queryClient.invalidateQueries({ queryKey: ['order'] });
      void queryClient.invalidateQueries({ queryKey: ['service-requests', outletId] });
    };

    const onServiceRequest = (payload: {
      tableName?: string | null;
      status?: string;
      reminded?: boolean;
    }) => {
      invalidate();
      if (payload.reminded === true) {
        setLatestCall({
          tableName: payload.tableName?.trim() || 'A table',
          at: Date.now(),
        });
        return;
      }
      // Banner on new open requests only (skip ack/resolve updates)
      if (payload.status === 'open' || !payload.status) {
        setLatestCall({
          tableName: payload.tableName?.trim() || 'A table',
          at: Date.now(),
        });
      }
    };

    socket.on('connect', () => {
      socket.emit('join_outlet', outletId);
    });

    socket.on('order.updated', invalidate);
    socket.on('order:updated', invalidate);
    socket.on('kot.created', invalidate);
    socket.on('kot:created', invalidate);
    socket.on('table.updated', invalidate);
    socket.on('service_request.created', onServiceRequest);
    socket.on('service_request:created', onServiceRequest);
    socket.on('service_request.updated', onServiceRequest);
    socket.on('service_request:updated', onServiceRequest);

    return () => {
      socket.emit('leave_outlet', outletId);
      socket.disconnect();
    };
  }, [outletId, accessToken, queryClient]);

  useEffect(() => {
    if (!latestCall) return;
    const timer = window.setTimeout(() => setLatestCall(null), 8_000);
    return () => window.clearTimeout(timer);
  }, [latestCall]);

  return { latestCall, dismissLatestCall: () => setLatestCall(null) };
}

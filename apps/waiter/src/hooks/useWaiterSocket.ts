import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { io, type Socket } from 'socket.io-client';
import { useAuthStore } from '@/stores/auth';

const WS_URL = import.meta.env.VITE_WS_URL ?? 'http://localhost:3000';

export function useWaiterSocket() {
  const queryClient = useQueryClient();
  const outletId = useAuthStore((s) => s.selectedOutletId);

  useEffect(() => {
    if (!outletId) return;

    const socket: Socket = io(WS_URL, {
      transports: ['websocket', 'polling'],
    });

    const invalidate = () => {
      void queryClient.invalidateQueries({ queryKey: ['tables', outletId] });
      void queryClient.invalidateQueries({ queryKey: ['table-orders'] });
      void queryClient.invalidateQueries({ queryKey: ['table-orders-detail'] });
      void queryClient.invalidateQueries({ queryKey: ['order'] });
    };

    socket.on('connect', () => {
      socket.emit('join_outlet', outletId);
    });

    socket.on('order.updated', invalidate);
    socket.on('order:updated', invalidate);
    socket.on('kot.created', invalidate);
    socket.on('kot:created', invalidate);
    socket.on('table.updated', invalidate);

    return () => {
      socket.emit('leave_outlet', outletId);
      socket.disconnect();
    };
  }, [outletId, queryClient]);
}

import { useEffect, useRef, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import { useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/stores/auth';

const WS_URL = import.meta.env.VITE_WS_URL ?? 'http://localhost:3000';

export type KitchenSocketStatus =
  | 'connecting'
  | 'connected'
  | 'disconnected'
  | 'error'
  | 'auth_failed';

export function useKitchenSocket(outletId: string | null): KitchenSocketStatus {
  const queryClient = useQueryClient();
  const accessToken = useAuthStore((s) => s.accessToken);
  const socketRef = useRef<Socket | null>(null);
  const [status, setStatus] = useState<KitchenSocketStatus>('disconnected');

  useEffect(() => {
    if (!outletId || !accessToken) {
      setStatus('disconnected');
      return;
    }

    setStatus('connecting');
    const socket = io(WS_URL, {
      transports: ['websocket', 'polling'],
      withCredentials: true,
      auth: { token: accessToken },
      query: { token: accessToken },
      reconnectionAttempts: 8,
      reconnectionDelay: 1500,
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      setStatus('connected');
      socket.emit('join_outlet', outletId);
    });

    socket.on('disconnect', (reason) => {
      // Server forced disconnect after failed JWT usually means expired/invalid session.
      if (reason === 'io server disconnect') {
        setStatus('auth_failed');
        return;
      }
      setStatus('disconnected');
    });

    socket.on('connect_error', (err) => {
      const message = err?.message?.toLowerCase() ?? '';
      if (message.includes('unauthorized') || message.includes('jwt') || message.includes('token')) {
        setStatus('auth_failed');
        return;
      }
      setStatus('error');
    });

    socket.on('error', (payload: { message?: string } | string) => {
      const message =
        typeof payload === 'string' ? payload : (payload?.message ?? '');
      if (/missing authentication|unauthorized|invalid token|jwt/i.test(message)) {
        setStatus('auth_failed');
      }
    });

    const invalidate = () => {
      queryClient.invalidateQueries({ queryKey: ['kitchen-display', outletId] });
    };

    socket.on('kot:created', invalidate);
    socket.on('kot:updated', invalidate);
    socket.on('kot.created', invalidate);
    socket.on('kot.updated', invalidate);
    socket.on('order:created', invalidate);
    socket.on('order:updated', invalidate);
    socket.on('order.created', invalidate);
    socket.on('order.updated', invalidate);

    return () => {
      socket.emit('leave_outlet', outletId);
      socket.disconnect();
      socketRef.current = null;
    };
  }, [outletId, accessToken, queryClient]);

  return status;
}

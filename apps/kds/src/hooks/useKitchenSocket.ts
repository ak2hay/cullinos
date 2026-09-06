import { useEffect, useRef, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import { useQueryClient } from '@tanstack/react-query';

const WS_URL = import.meta.env.VITE_WS_URL ?? 'http://localhost:3000';

export type KitchenSocketStatus = 'connecting' | 'connected' | 'disconnected' | 'error';

export function useKitchenSocket(outletId: string | null): KitchenSocketStatus {
  const queryClient = useQueryClient();
  const socketRef = useRef<Socket | null>(null);
  const [status, setStatus] = useState<KitchenSocketStatus>('disconnected');

  useEffect(() => {
    if (!outletId) {
      setStatus('disconnected');
      return;
    }

    setStatus('connecting');
    const socket = io(WS_URL, {
      transports: ['websocket', 'polling'],
      withCredentials: true,
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      setStatus('connected');
      socket.emit('join_outlet', outletId);
    });

    socket.on('disconnect', () => {
      setStatus('disconnected');
    });

    socket.on('connect_error', () => {
      setStatus('error');
    });

    const invalidate = () => {
      queryClient.invalidateQueries({ queryKey: ['kitchen-display', outletId] });
    };

    socket.on('kot:created', invalidate);
    socket.on('kot:updated', invalidate);
    socket.on('order:created', invalidate);
    socket.on('order:updated', invalidate);

    return () => {
      socket.emit('leave_outlet', outletId);
      socket.disconnect();
      socketRef.current = null;
    };
  }, [outletId, queryClient]);

  return status;
}

import { useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import { useQueryClient } from '@tanstack/react-query';
const WS_URL = import.meta.env.VITE_WS_URL ?? 'http://localhost:3000';
export function useKitchenSocket(outletId) {
    const queryClient = useQueryClient();
    const socketRef = useRef(null);
    useEffect(() => {
        if (!outletId)
            return;
        const socket = io(WS_URL, {
            transports: ['websocket', 'polling'],
            withCredentials: true,
        });
        socketRef.current = socket;
        socket.on('connect', () => {
            socket.emit('join_outlet', outletId);
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
}

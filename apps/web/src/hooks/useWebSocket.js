import { useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
export function useWebSocket({ onMetricsUpdate, onProcessStatusChange }) {
    const socketRef = useRef(null);
    useEffect(() => {
        socketRef.current = io('/', {
            transports: ['websocket'],
            withCredentials: true,
        });
        socketRef.current.on('connect', () => {
            // Connection established
        });
        socketRef.current.on('disconnect', () => {
            // Connection closed
        });
        socketRef.current.on('metrics:update', (metrics) => {
            onMetricsUpdate?.(metrics);
        });
        socketRef.current.on('process:status-change', (data) => {
            onProcessStatusChange?.(data);
        });
        // Subscribe to metrics on connect
        socketRef.current.emit('metrics:subscribe');
        return () => {
            if (socketRef.current) {
                socketRef.current.emit('metrics:unsubscribe');
                socketRef.current.disconnect();
            }
        };
    }, [onMetricsUpdate, onProcessStatusChange]);
    return socketRef.current;
}

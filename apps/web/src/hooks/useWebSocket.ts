import { useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import type { SystemMetrics } from '@serverctrl/shared';

interface UseWebSocketOptions {
  onMetricsUpdate?: (metrics: SystemMetrics) => void;
  onProcessStatusChange?: (data: { name: string; oldStatus: string; newStatus: string }) => void;
}

export function useWebSocket({ onMetricsUpdate, onProcessStatusChange }: UseWebSocketOptions) {
  const socketRef = useRef<Socket | null>(null);

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

    socketRef.current.on('metrics:update', (metrics: SystemMetrics) => {
      onMetricsUpdate?.(metrics);
    });

    socketRef.current.on(
      'process:status-change',
      (data: { name: string; oldStatus: string; newStatus: string }) => {
        onProcessStatusChange?.(data);
      },
    );

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

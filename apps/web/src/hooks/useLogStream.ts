import { useEffect, useRef, useCallback, useState } from 'react';
import { io, Socket } from 'socket.io-client';

export interface UseLogStreamOptions {
  processName: string;
  level?: 'info' | 'warn' | 'error' | undefined;
  enabled?: boolean;
}

export interface UseLogStreamResult {
  logs: string[];
  isStreaming: boolean;
  pause: () => void;
  resume: () => void;
  clear: () => void;
}

export function useLogStream({
  processName,
  level,
  enabled = true,
}: UseLogStreamOptions): UseLogStreamResult {
  const socketRef = useRef<Socket | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const bufferRef = useRef<string[]>([]);
  const flushTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Flush buffer to state periodically
  const flushBuffer = useCallback(() => {
    if (bufferRef.current.length > 0) {
      setLogs((prev) => [...prev, ...bufferRef.current]);
      bufferRef.current = [];
    }
  }, []);

  // Connect to WebSocket
  useEffect(() => {
    if (!processName || !enabled) {
      if (socketRef.current) {
        socketRef.current.emit('log:unsubscribe', { processName });
        socketRef.current.disconnect();
        socketRef.current = null;
        setIsStreaming(false);
      }
      return;
    }

    // Create socket connection
    const socket = io('/', {
      transports: ['websocket'],
      withCredentials: true,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      setIsStreaming(true);
      socket.emit('log:subscribe', { processName, level });
    });

    socket.on('disconnect', () => {
      setIsStreaming(false);
    });

    socket.on('log:line', (data: { processName: string; line: string }) => {
      if (!isPaused) {
        bufferRef.current.push(data.line);

        // Flush immediately if buffer gets large
        if (bufferRef.current.length >= 10) {
          flushBuffer();
        } else {
          // Or flush after a short delay
          // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
          if (!flushTimeoutRef.current) {
            flushTimeoutRef.current = setTimeout(() => {
              flushBuffer();
              flushTimeoutRef.current = null;
            }, 50);
          }
        }
      }
    });

    return () => {
      if (flushTimeoutRef.current) {
        clearTimeout(flushTimeoutRef.current);
      }
      socket.emit('log:unsubscribe', { processName });
      socket.disconnect();
      setIsStreaming(false);
    };
  }, [processName, level, enabled, isPaused, flushBuffer]);

  const pause = useCallback(() => {
    setIsPaused(true);
  }, []);

  const resume = useCallback(() => {
    setIsPaused(false);
  }, []);

  const clear = useCallback(() => {
    setLogs([]);
    bufferRef.current = [];
  }, []);

  return {
    logs,
    isStreaming,
    pause,
    resume,
    clear,
  };
}

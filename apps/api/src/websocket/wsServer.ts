import { Server as SocketIOServer, Socket } from 'socket.io';
import { wsLogger } from '../lib/logger.js';
import { systemMetricsService } from '../services/systemMetrics.service.js';
import { logStreamService } from '../services/logStream.service.js';
import type { SystemMetrics, LogLine } from '@serverctrl/shared';

interface AuthenticatedSocket extends Socket {
  userId?: number;
  username?: string;
}

interface LogSubscription {
  processName?: string;
  level?: 'info' | 'warn' | 'error';
  [key: string]: unknown;
}

export class WebSocketServer {
  private io: SocketIOServer;
  private metricsInterval: NodeJS.Timeout | null = null;
  private subscribedClients = new Map<string, Set<string>>(); // socketId -> subscribed processes
  private clientSubscriptions = new Map<string, LogSubscription>(); // socketId -> subscription

  constructor(io: SocketIOServer) {
    this.io = io;
  }

  initialize(): void {
    this.io.on('connection', (socket: AuthenticatedSocket) => {
      wsLogger.info(`Client connected: ${socket.id}`);

      // Get token from auth handshake
      const token = socket.handshake.auth?.token as string | undefined;
      if (token) {
        // Token validation would happen here
        // For now, we trust the REST auth
      }

      // Metrics subscription
      socket.on('metrics:subscribe', () => {
        wsLogger.info(`${socket.id} subscribed to metrics`);
        this.subscribedClients.set(socket.id, new Set());

        if (this.subscribedClients.size === 1) {
          this.startMetricsBroadcast();
        }
      });

      socket.on('metrics:unsubscribe', () => {
        wsLogger.info(`${socket.id} unsubscribed from metrics`);
        this.subscribedClients.delete(socket.id);

        if (this.subscribedClients.size === 0) {
          this.stopMetricsBroadcast();
        }
      });

      // Log subscription
      socket.on('log:subscribe', (subscription: LogSubscription) => {
        wsLogger.info(`${socket.id} subscribed to logs`, subscription);
        this.clientSubscriptions.set(socket.id, subscription);

        // If processName specified, start streaming that log
        if (subscription.processName) {
          const logPath = `${process.env.HOME}/.pm2/logs/${subscription.processName}-out.log`;
          logStreamService.startStream({
            processName: subscription.processName,
            logPath,
          });

          // Send reconnection buffer (up to 500 recent lines)
          const bufferedLines = logStreamService.getBuffer(subscription.processName);
          if (bufferedLines.length > 0) {
            socket.emit('log:buffer', {
              processName: subscription.processName,
              lines: bufferedLines,
            });
          }
        }
      });

      socket.on('log:unsubscribe', () => {
        wsLogger.info(`${socket.id} unsubscribed from logs`);
        const sub = this.clientSubscriptions.get(socket.id);
        if (sub?.processName) {
          logStreamService.stopStream(sub.processName);
        }
        this.clientSubscriptions.delete(socket.id);
      });

      socket.on('disconnect', () => {
        wsLogger.info(`Client disconnected: ${socket.id}`);

        // Cleanup metrics subscription
        this.subscribedClients.delete(socket.id);
        if (this.subscribedClients.size === 0) {
          this.stopMetricsBroadcast();
        }

        // Cleanup log subscription
        const sub = this.clientSubscriptions.get(socket.id);
        if (sub?.processName) {
          logStreamService.stopStream(sub.processName);
        }
        this.clientSubscriptions.delete(socket.id);
      });
    });

    // Listen for log lines from LogStreamService
    logStreamService.on('line', (logLine: LogLine) => {
      // Broadcast to all clients subscribed to this process
      for (const [socketId, sub] of this.clientSubscriptions) {
        if (sub.processName === logLine.processName || !sub.processName) {
          // Filter by level if specified
          if (sub.level && logLine.level !== sub.level) {
            continue;
          }

          this.io.to(socketId).emit('log:line', logLine);
        }
      }
    });
  }

  private startMetricsBroadcast(): void {
    if (this.metricsInterval) return;

    wsLogger.info('Starting metrics broadcast');

    this.metricsInterval = setInterval(async () => {
      if (this.subscribedClients.size === 0) {
        this.stopMetricsBroadcast();
        return;
      }

      try {
        const metrics: SystemMetrics = await systemMetricsService.getSnapshot();

        for (const socketId of this.subscribedClients.keys()) {
          this.io.to(socketId).emit('metrics:update', metrics);
        }
      } catch (error) {
        wsLogger.error('Metrics broadcast error', {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }, 5000); // Every 5 seconds
  }

  private stopMetricsBroadcast(): void {
    if (this.metricsInterval) {
      wsLogger.info('Stopping metrics broadcast');
      clearInterval(this.metricsInterval);
      this.metricsInterval = null;
    }
  }

  shutdown(): void {
    this.stopMetricsBroadcast();
    logStreamService.stopAll();
    void this.io.close();
  }
}

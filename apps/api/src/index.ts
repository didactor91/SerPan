import express from 'express';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { loadEnv, getEnv } from './config/env.js';
import { errorHandler } from './middleware/errorHandler.js';
import { createApiRouter } from './api/router.js';
import { WebSocketServer } from './websocket/wsServer.js';
import { getDatabase, closeDatabase } from './db/schema.js';
import { apiLogger } from './lib/logger.js';

loadEnv();
const env = getEnv();

const app = express();
const httpServer = createServer(app);

// Socket.io setup
const io = new SocketIOServer(httpServer, {
  cors: {
    origin: env.NODE_ENV === 'production' ? false : true,
    credentials: true,
  },
});

// Middleware
app.use(helmet());
app.use(
  cors({
    origin: env.NODE_ENV === 'production' ? 'https://panel.didtor.dev' : true,
    credentials: true,
  }),
);
app.use(express.json());
app.use(cookieParser());

// Health check (no auth required)
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API routes
app.use('/api/v1', createApiRouter());

// Error handler
app.use(errorHandler);

// WebSocket
const wsServer = new WebSocketServer(io);
wsServer.initialize();

// Graceful shutdown
function shutdown(): void {
  apiLogger.info('Shutting down...');
  void io.close();
  closeDatabase();
  httpServer.close(() => {
    apiLogger.info('Shutdown complete');
    process.exit(0);
  });
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

// Start
const port = env.PORT;
httpServer.listen(port, () => {
  apiLogger.info(`ServerCtrl API running on port ${String(port)}`);
  apiLogger.info(`Environment: ${env.NODE_ENV}`);

  // Initialize database
  getDatabase();
});

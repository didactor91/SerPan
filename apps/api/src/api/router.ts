import { Router } from 'express';
import authRoutes from './routes/auth.routes.js';
import webauthnRoutes from './routes/webauthn.routes.js';
import processesRoutes from './routes/processes.routes.js';
import systemRoutes from './routes/system.routes.js';
import proxyRoutes from './routes/proxy.routes.js';
import logsRoutes from './routes/logs.routes.js';
import { authMiddleware } from '../middleware/auth.middleware.js';

export function createApiRouter(): Router {
  const router = Router();

  // Auth routes (no auth required for login)
  router.use('/auth', authRoutes);
  router.use('/auth/webauthn', webauthnRoutes);

  // Protected routes
  router.use('/processes', authMiddleware, processesRoutes);
  router.use('/system', authMiddleware, systemRoutes);
  router.use('/proxy', authMiddleware, proxyRoutes);
  router.use('/logs', authMiddleware, logsRoutes);

  return router;
}

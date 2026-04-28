import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';

// Mock dependencies
vi.mock('../../services/pm2.service.js', () => ({
  pm2Service: {
    list: vi.fn().mockResolvedValue([
      {
        name: 'app1',
        status: 'online',
        pid: 1234,
        cpu: 5.5,
        memory: 256000000,
        instances: 1,
        uptime: 3600000,
      },
      { name: 'app2', status: 'stopped', pid: 0, cpu: 0, memory: 0, instances: 1, uptime: 0 },
    ]),
    start: vi.fn().mockResolvedValue(undefined),
    stop: vi.fn().mockResolvedValue(undefined),
    restart: vi.fn().mockResolvedValue(undefined),
    reload: vi.fn().mockResolvedValue(undefined),
    scale: vi.fn().mockResolvedValue(undefined),
    getLogs: vi.fn().mockResolvedValue(['log line 1', 'log line 2']),
  },
}));

vi.mock('../../middleware/auth.middleware.js', () => ({
  authMiddleware: (_req: unknown, _res: unknown, next: () => void) => {
    next();
  },
}));

describe('Processes Routes', () => {
  let app: ReturnType<typeof express>;

  beforeEach(async () => {
    vi.clearAllMocks();

    app = express();
    app.use(express.json());

    const { default: processesRoutes } = await import('./processes.routes.js');
    app.use('/processes', processesRoutes);

    // Error handler
    app.use(
      (err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
        res.status(500).json({ error: { message: err.message } });
      },
    );
  });

  describe('GET /processes', () => {
    it('should return list of processes', async () => {
      const { default: request } = await import('supertest');

      // Import after mocks are set up
      const express = (await import('express')).default;
      const testApp = express();
      testApp.use(express.json());
      const { default: processesRoutes } = await import('./processes.routes.js');
      testApp.use('/processes', processesRoutes);

      const res = await request(testApp).get('/processes');

      expect(res.status).toBe(200);
      expect(res.body.data.processes).toHaveLength(2);
      expect(res.body.data.processes[0].name).toBe('app1');
    });
  });
});

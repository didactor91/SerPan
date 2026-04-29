import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import { ValidationError } from '../../middleware/errorHandler.js';

// Mock CaddyService
vi.mock('../../services/caddy.service.js', () => ({
  caddyService: {
    getConfig: vi.fn(),
    getRoutes: vi.fn(),
    addRoute: vi.fn(),
    removeRoute: vi.fn(),
    updateRoute: vi.fn(),
    getCertificates: vi.fn(),
    getSnapshots: vi.fn(),
    rollback: vi.fn(),
    saveSnapshot: vi.fn(),
  },
}));

import { caddyService } from '../../services/caddy.service.js';

const { default: proxyRouter } = await vi.importActual<{ default: express.Router }>(
  '../../api/routes/proxy.routes.js',
);

// Create app with async-aware error handler
function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/proxy', proxyRouter);
  // Error handler that properly closes response
  app.use(
    (err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
      if (err instanceof ValidationError) {
        res
          .status(err.statusCode)
          .json({ error: { code: err.code, message: err.message, statusCode: err.statusCode } });
      } else {
        res.status(500).json({ error: { message: err.message } });
      }
    },
  );
  return app;
}

describe('Proxy Routes', () => {
  let app: express.Express;

  beforeEach(() => {
    vi.clearAllMocks();
    app = createApp();
  });

  // GET /proxy/config
  describe('GET /proxy/config', () => {
    it('should return Caddy config', async () => {
      const mockConfig = { apps: { http: { servers: { srv0: {} } } } };
      vi.mocked(caddyService.getConfig).mockResolvedValue(mockConfig as never);

      const res = await request(app).get('/proxy/config');

      expect(res.status).toBe(200);
      expect(res.body.data).toEqual(mockConfig);
    });
  });

  // GET /proxy/routes
  describe('GET /proxy/routes', () => {
    it('should return list of routes', async () => {
      const mockRoutes = [
        { '@id': 'route_1', match: [{ host: ['example.com'] }], handle: [], terminal: true },
      ];
      vi.mocked(caddyService.getRoutes).mockResolvedValue(mockRoutes);

      const res = await request(app).get('/proxy/routes');

      expect(res.status).toBe(200);
      expect(res.body.data.routes).toHaveLength(1);
      expect(res.body.data.routes[0]['@id']).toBe('route_1');
    });
  });

  // POST /proxy/routes
  describe('POST /proxy/routes', () => {
    it('should add a new route', async () => {
      vi.mocked(caddyService.saveSnapshot).mockResolvedValue(1);
      vi.mocked(caddyService.addRoute).mockResolvedValue('route_new123');

      const res = await request(app)
        .post('/proxy/routes')
        .send({ host: 'example.com', upstreamPort: 3000, tls: true });

      expect(res.status).toBe(200);
      expect(res.body.data.routeId).toBe('route_new123');
      expect(caddyService.addRoute).toHaveBeenCalledWith('example.com', 3000, true);
    });

    it('should save snapshot before modifying routes', async () => {
      vi.mocked(caddyService.saveSnapshot).mockResolvedValue(1);
      vi.mocked(caddyService.addRoute).mockResolvedValue('route_abc');

      await request(app).post('/proxy/routes').send({ host: 'test.com', upstreamPort: 4000 });

      expect(caddyService.saveSnapshot).toHaveBeenCalledWith('Before modifying routes');
    });

    it('should default tls to true when not provided', async () => {
      vi.mocked(caddyService.saveSnapshot).mockResolvedValue(1);
      vi.mocked(caddyService.addRoute).mockResolvedValue('route_def');

      await request(app).post('/proxy/routes').send({ host: 'test.com', upstreamPort: 5000 });

      expect(caddyService.addRoute).toHaveBeenCalledWith('test.com', 5000, true);
    });
  });

  // PUT /proxy/routes/:id
  describe('PUT /proxy/routes/:id', () => {
    it('should update an existing route', async () => {
      vi.mocked(caddyService.saveSnapshot).mockResolvedValue(1);
      vi.mocked(caddyService.updateRoute).mockResolvedValue();

      const res = await request(app)
        .put('/proxy/routes/route_123')
        .send({ host: 'new.example.com', upstreamPort: 8080, tls: false });

      expect(res.status).toBe(200);
      expect(caddyService.updateRoute).toHaveBeenCalledWith(
        'route_123',
        'new.example.com',
        8080,
        false,
      );
    });
  });

  // DELETE /proxy/routes/:id
  describe('DELETE /proxy/routes/:id', () => {
    it('should delete a route', async () => {
      vi.mocked(caddyService.saveSnapshot).mockResolvedValue(1);
      vi.mocked(caddyService.removeRoute).mockResolvedValue();

      const res = await request(app).delete('/proxy/routes/route_123');

      expect(res.status).toBe(200);
      expect(caddyService.removeRoute).toHaveBeenCalledWith('route_123');
    });
  });

  // GET /proxy/snapshots
  describe('GET /proxy/snapshots', () => {
    it('should return list of snapshots', async () => {
      const mockSnapshots = [
        { id: 1, config: '{}', description: 'Test snapshot', createdAt: '2026-04-28' },
      ];
      vi.mocked(caddyService.getSnapshots).mockResolvedValue(mockSnapshots);

      const res = await request(app).get('/proxy/snapshots');

      expect(res.status).toBe(200);
      expect(res.body.data.snapshots).toHaveLength(1);
    });
  });

  // POST /proxy/rollback/:id
  describe('POST /proxy/rollback/:id', () => {
    it('should rollback to snapshot', async () => {
      vi.mocked(caddyService.rollback).mockResolvedValue();

      const res = await request(app).post('/proxy/rollback/1');

      expect(res.status).toBe(200);
      expect(caddyService.rollback).toHaveBeenCalledWith(1);
    });
  });

  // GET /proxy/certs
  describe('GET /proxy/certs', () => {
    it('should return certificates', async () => {
      const mockCerts = [
        {
          domain: 'example.com',
          notBefore: '',
          notAfter: '',
          issuer: 'LetsEncrypt',
          daysUntilExpiry: 30,
        },
      ];
      vi.mocked(caddyService.getCertificates).mockResolvedValue(mockCerts);

      const res = await request(app).get('/proxy/certs');

      expect(res.status).toBe(200);
      expect(res.body.data.certificates).toHaveLength(1);
    });
  });

  // GET /proxy/domains
  describe('GET /proxy/domains', () => {
    it('should return domains extracted from routes', async () => {
      const mockRoutes = [
        {
          '@id': 'route_abc',
          match: [{ host: ['example.com'] }],
          handle: [
            { handler: 'reverse_proxy', upstreams: [{ dial: 'localhost:3000' }] },
            { handler: 'tls' },
          ],
          terminal: true,
        },
      ];
      vi.mocked(caddyService.getRoutes).mockResolvedValue(mockRoutes);

      const res = await request(app).get('/proxy/domains');

      expect(res.status).toBe(200);
      expect(res.body.data.domains).toHaveLength(1);
      expect(res.body.data.domains[0]).toEqual({
        domain: 'example.com',
        upstream: 'localhost:3000',
        tls: true,
        routeId: 'route_abc',
      });
    });

    it('should handle routes without upstream', async () => {
      const mockRoutes = [
        {
          '@id': 'route_no_upstream',
          match: [{ host: ['test.com'] }],
          handle: [{ handler: 'static' }],
          terminal: true,
        },
      ];
      vi.mocked(caddyService.getRoutes).mockResolvedValue(mockRoutes);

      const res = await request(app).get('/proxy/domains');

      expect(res.status).toBe(200);
      expect(res.body.data.domains[0].upstream).toBeNull();
    });

    it('should filter out malformed routes', async () => {
      const mockRoutes = [
        { '@id': 'route_1', match: [{}], handle: [], terminal: true },
        { '@id': 'route_2', match: [{ host: ['valid.com'] }], handle: [], terminal: true },
      ];
      vi.mocked(caddyService.getRoutes).mockResolvedValue(mockRoutes as never);

      const res = await request(app).get('/proxy/domains');

      expect(res.status).toBe(200);
      expect(res.body.data.domains).toHaveLength(1);
      expect(res.body.data.domains[0].domain).toBe('valid.com');
    });

    it('should extract TLS status from route handlers', async () => {
      const mockRoutes = [
        {
          '@id': 'route_no_tls',
          match: [{ host: ['http-only.com'] }],
          handle: [{ handler: 'reverse_proxy', upstreams: [{ dial: 'localhost:80' }] }],
          terminal: true,
        },
      ];
      vi.mocked(caddyService.getRoutes).mockResolvedValue(mockRoutes);

      const res = await request(app).get('/proxy/domains');

      expect(res.status).toBe(200);
      expect(res.body.data.domains[0].tls).toBe(false);
    });
  });
});

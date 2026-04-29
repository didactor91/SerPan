import { Router, type Router as ExpressRouter } from 'express';
import { z } from 'zod';
import type { Request, Response } from 'express';
import { caddyService } from '../../services/caddy.service.js';
import { ValidationError } from '../../middleware/errorHandler.js';

const router: ExpressRouter = Router();

// Shared Zod schemas
const HostnameSchema = z
  .string()
  .min(1, 'hostname is required')
  .regex(
    /^[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?)*$/,
    'Invalid hostname format',
  );

const PortSchema = z.number().int().min(1).max(65535, 'Port must be between 1 and 65535');

const CreateRouteSchema = z.object({
  host: HostnameSchema,
  upstreamPort: PortSchema,
  tls: z.boolean().optional().default(true),
});

const UpdateRouteSchema = z.object({
  host: HostnameSchema,
  upstreamPort: PortSchema,
  tls: z.boolean().optional().default(true),
});

// GET /proxy/config
router.get('/config', async (_req: Request, res: Response) => {
  const config = await caddyService.getConfig();
  res.json({ data: config });
});

// GET /proxy/routes
router.get('/routes', async (_req: Request, res: Response) => {
  const routes = await caddyService.getRoutes();
  res.json({ data: { routes } });
});

// POST /proxy/routes
router.post('/routes', async (req: Request, res: Response) => {
  const parsed = CreateRouteSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new ValidationError(
      `Invalid request: ${parsed.error.errors.map((e) => e.message).join(', ')}`,
    );
  }

  const { host, upstreamPort, tls } = parsed.data;

  // Save snapshot before change
  await caddyService.saveSnapshot('Before modifying routes');

  const routeId = await caddyService.addRoute(host, upstreamPort, tls);

  res.json({ data: { routeId, message: 'Route added successfully' } });
});

// PUT /proxy/routes/:id
router.put('/routes/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  if (!id) {
    throw new ValidationError('id is required');
  }

  const parsed = UpdateRouteSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new ValidationError(
      `Invalid request: ${parsed.error.errors.map((e) => e.message).join(', ')}`,
    );
  }

  const { host, upstreamPort, tls } = parsed.data;

  await caddyService.saveSnapshot('Before modifying routes');

  await caddyService.updateRoute(id, host, upstreamPort, tls);

  res.json({ data: { message: 'Route updated successfully' } });
});

// DELETE /proxy/routes/:id
router.delete('/routes/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  if (!id) {
    throw new ValidationError('id is required');
  }

  await caddyService.saveSnapshot('Before deleting route');

  await caddyService.removeRoute(id);

  res.json({ data: { message: 'Route deleted successfully' } });
});

// GET /proxy/snapshots
router.get('/snapshots', async (_req: Request, res: Response) => {
  const snapshots = await caddyService.getSnapshots();
  res.json({ data: { snapshots } });
});

// POST /proxy/rollback/:id
router.post('/rollback/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  if (!id) {
    throw new ValidationError('id is required');
  }

  // Parse id as number (SQLite integer primary key)
  const snapshotIdNum = Number.parseInt(id, 10);
  if (Number.isNaN(snapshotIdNum)) {
    throw new ValidationError('id must be a valid integer');
  }

  await caddyService.rollback(snapshotIdNum);

  res.json({ data: { message: 'Rollback completed successfully' } });
});

// GET /proxy/certs
router.get('/certs', async (_req: Request, res: Response) => {
  const certs = await caddyService.getCertificates();
  res.json({ data: { certificates: certs } });
});

// GET /proxy/domains — extract domains from Caddy routes
router.get('/domains', async (_req: Request, res: Response) => {
  const routes = await caddyService.getRoutes();

  const domains = routes
    .map((route) => {
      const match = route.match[0];
      if (!match) return null;
      const hostname = typeof match.host !== 'undefined' ? match.host[0] : undefined;
      if (!hostname) return null;

      const reverseProxy = route.handle.find((h) => h.handler === 'reverse_proxy');
      const upstream = reverseProxy?.upstreams?.[0]?.dial ?? null;
      const hasTLS = route.handle.some((h) => h.handler === 'tls');

      return {
        domain: hostname,
        upstream,
        tls: hasTLS,
        routeId: route['@id'],
      };
    })
    .filter(
      (d): d is { domain: string; upstream: string | null; tls: boolean; routeId: string } =>
        d !== null,
    );

  res.json({ data: { domains } });
});

export default router;

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CaddyService } from './caddy.service.js';

// Mock fetch
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

describe('CaddyService', () => {
  let caddyService: CaddyService;

  beforeEach(() => {
    vi.clearAllMocks();
    caddyService = new CaddyService('http://localhost:2019');
  });

  describe('getConfig', () => {
    it('should return parsed Caddy config', async () => {
      const mockConfig = {
        apps: {
          http: {
            servers: {
              srv0: {
                listen: [':80', ':443'],
                routes: [],
              },
            },
          },
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockConfig),
      });

      const config = await caddyService.getConfig();

      expect(config).toEqual(mockConfig);
      expect(mockFetch).toHaveBeenCalledWith('http://localhost:2019/config/');
    });

    it('should throw error if Caddy is unavailable', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        statusText: 'Service Unavailable',
      });

      await expect(caddyService.getConfig()).rejects.toThrow(
        'Failed to fetch Caddy config: Service Unavailable',
      );
    });
  });

  describe('getRoutes', () => {
    it('should return routes from srv0 server', async () => {
      const mockRoutes = [
        {
          '@id': 'route_test123',
          match: [{ host: ['example.com'] }],
          handle: [{ handler: 'reverse_proxy', upstreams: [{ dial: 'localhost:3000' }] }],
          terminal: true,
        },
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            apps: { http: { servers: { srv0: { routes: mockRoutes } } } },
          }),
      });

      const routes = await caddyService.getRoutes();

      expect(routes).toHaveLength(1);
      expect(routes[0]['@id']).toBe('route_test123');
      expect(routes[0].match[0].host[0]).toBe('example.com');
    });

    it('should return empty array if no routes', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ apps: { http: { servers: { srv0: {} } } } }),
      });

      const routes = await caddyService.getRoutes();
      expect(routes).toEqual([]);
    });
  });

  describe('addRoute', () => {
    it('should add a route and return routeId', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        statusText: 'OK',
      });

      const routeId = await caddyService.addRoute('example.com', 3000, true);

      expect(routeId).toMatch(/^route_[A-Z0-9]+$/);
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:2019/config/apps/http/servers/srv0/routes/',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        }),
      );

      // Verify the request body contains the route
      const calledWith = mockFetch.mock.calls[0][1] as { body: string };
      const parsedBody = JSON.parse(calledWith.body);
      expect(parsedBody['@id']).toBe(routeId);
      expect(parsedBody.match[0].host[0]).toBe('example.com');
      expect(parsedBody.handle[0].upstreams[0].dial).toBe('localhost:3000');
    });

    it('should add route without TLS if tls is false', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
      });

      await caddyService.addRoute('example.com', 3000, false);

      const calledWith = mockFetch.mock.calls[0][1] as { body: string };
      const parsedBody = JSON.parse(calledWith.body);
      // Should not have TLS handler
      expect(parsedBody.handle.some((h: { handler: string }) => h.handler === 'tls')).toBe(false);
    });

    it('should throw error if add route fails', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        statusText: 'Bad Request',
      });

      await expect(caddyService.addRoute('example.com', 3000)).rejects.toThrow(
        'Failed to add route: Bad Request',
      );
    });
  });

  describe('removeRoute', () => {
    it('should call DELETE on the route id', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
      });

      await caddyService.removeRoute('route_test123');

      expect(mockFetch).toHaveBeenCalledWith('http://localhost:2019/id/route_test123', {
        method: 'DELETE',
      });
    });
  });

  describe('getCertificates', () => {
    it('should return formatted certificate info', async () => {
      const now = new Date();
      const notAfter = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve([
            {
              not_after: notAfter.toISOString(),
              not_before: now.toISOString(),
              names: ['example.com'],
              issuer: { name: 'LetsEncrypt' },
            },
          ]),
      });

      const certs = await caddyService.getCertificates();

      expect(certs).toHaveLength(1);
      expect(certs[0].domain).toBe('example.com');
      expect(certs[0].issuer).toBe('LetsEncrypt');
      expect(certs[0].daysUntilExpiry).toBeGreaterThan(0);
    });

    it('should return empty array if fetch fails', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
      });

      const certs = await caddyService.getCertificates();
      expect(certs).toEqual([]);
    });
  });

  describe('ULID generation', () => {
    it('should generate unique route IDs', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
      });

      const id1 = await caddyService.addRoute('example.com', 3000);
      const id2 = await caddyService.addRoute('test.com', 4000);

      expect(id1).not.toBe(id2);
      expect(id1).toMatch(/^route_[A-Z0-9]{26}$/);
      expect(id2).toMatch(/^route_[A-Z0-9]{26}$/);
    });
  });
});

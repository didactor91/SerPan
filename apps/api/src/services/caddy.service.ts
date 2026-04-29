/* eslint-disable @typescript-eslint/no-unnecessary-condition */
import { apiLogger } from '../lib/logger.js';

interface CaddyRoute {
  '@id': string;
  match: { host: string[] }[];
  handle: {
    handler: string;
    upstreams?: { dial: string }[];
    tls?: {
      enabled: boolean;
      automatic_https: string;
    };
  }[];
  terminal: boolean;
}

interface CaddyConfig {
  apps?: {
    http?: {
      servers?: Record<
        string,
        {
          listen: string[];
          routes?: CaddyRoute[];
        }
      >;
    };
  };
}

interface TLSCertificate {
  domain: string;
  notBefore: string;
  notAfter: string;
  issuer: string;
  daysUntilExpiry: number;
}

interface ProxySnapshot {
  id?: number;
  config: string;
  description?: string;
  createdAt: string;
}

export interface Database {
  prepare(sql: string): {
    run(...args: unknown[]): void;
    get(...args: unknown[]): unknown;
    all(): ProxySnapshot[];
  };
}

// ULID generation (simple implementation)
function generateId(): string {
  const chars = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
  let id = '';
  for (let i = 0; i < 26; i++) {
    const charIndex = Math.floor(Math.random() * chars.length);
    id += chars.charAt(charIndex);
  }
  return id;
}

export class CaddyService {
  private readonly apiBase: string;

  constructor(apiBase = 'http://localhost:2019') {
    this.apiBase = apiBase;
  }

  async getConfig(): Promise<CaddyConfig> {
    const res = await fetch(`${this.apiBase}/config/`);
    if (!res.ok) {
      throw new Error(`Failed to fetch Caddy config: ${res.statusText}`);
    }
    const json = (await res.json()) as CaddyConfig;
    return json;
  }

  async getRoutes(): Promise<CaddyRoute[]> {
    const config = await this.getConfig();
    const server = config.apps?.http?.servers?.srv0;
    return server?.routes ?? [];
  }

  async addRoute(host: string, upstreamPort: number, tls = true): Promise<string> {
    const routeId = `route_${generateId()}`;

    const route: CaddyRoute = {
      '@id': routeId,
      match: [{ host: [host] }],
      handle: [
        {
          handler: 'reverse_proxy',
          upstreams: [{ dial: `localhost:${String(upstreamPort)}` }],
        },
      ],
      terminal: true,
    };

    // Add TLS handler if enabled
    if (tls) {
      route.handle.push({
        handler: 'tls',
        tls: {
          enabled: true,
          automatic_https: 'on',
        },
      });
    }

    const res = await fetch(`${this.apiBase}/config/apps/http/servers/srv0/routes/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(route),
    });

    if (!res.ok) {
      throw new Error(`Failed to add route: ${res.statusText}`);
    }

    apiLogger.info('Route added', { host, upstreamPort, routeId });
    return routeId;
  }

  async removeRoute(routeId: string): Promise<void> {
    const res = await fetch(`${this.apiBase}/id/${routeId}`, {
      method: 'DELETE',
    });

    if (!res.ok) {
      throw new Error(`Failed to remove route: ${res.statusText}`);
    }

    apiLogger.info('Route removed', { routeId });
  }

  async updateRoute(
    routeId: string,
    host: string,
    upstreamPort: number,
    tls = true,
  ): Promise<void> {
    // Remove and re-add (Caddy doesn't have full PATCH support)
    await this.removeRoute(routeId);
    await this.addRoute(host, upstreamPort, tls);
    apiLogger.info('Route updated', { routeId, host, upstreamPort });
  }

  async getCertificates(): Promise<TLSCertificate[]> {
    try {
      const res = await fetch(`${this.apiBase}/caddyconfig/certificates`);
      if (!res.ok) {
        return [];
      }

      const certsRaw = (await res.json()) as {
        not_after?: string;
        not_before?: string;
        names?: string[];
        issuer?: { name?: string };
      }[];
      const now = new Date();

      const certs: TLSCertificate[] = certsRaw.map((cert) => {
        const notAfter = new Date(cert.not_after ?? now.toISOString());
        const diffTime = notAfter.getTime() - now.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        return {
          domain: cert.names?.[0] ?? 'unknown',
          notBefore: cert.not_before ?? now.toISOString(),
          notAfter: cert.not_after ?? now.toISOString(),
          issuer: cert.issuer?.name ?? 'unknown',
          daysUntilExpiry: diffDays,
        };
      });

      return certs;
    } catch (error) {
      apiLogger.error('Failed to fetch certificates', {
        error: error instanceof Error ? error.message : String(error),
      });
      return [];
    }
  }

  async saveSnapshot(description: string, db: Database): Promise<number> {
    const config = await this.getConfig();
    const configJson = JSON.stringify(config);

    db.prepare('INSERT INTO proxy_snapshots (config, description) VALUES (?, ?)').run(
      configJson,
      description,
    );

    db.prepare(
      'DELETE FROM proxy_snapshots WHERE id NOT IN (SELECT id FROM proxy_snapshots ORDER BY id DESC LIMIT 10)',
    ).run();

    const snapshot = db.prepare('SELECT last_insert_rowid() as id').get(0) as
      | { id: number }
      | undefined;
    const id = snapshot?.id ?? 0;
    apiLogger.info('Snapshot saved', { description, id });
    return id;
  }

  async rollback(snapshotId: number, db: Database): Promise<void> {
    const snapshot = db
      .prepare('SELECT config FROM proxy_snapshots WHERE id = ?')
      .get(snapshotId) as { config: string } | undefined;

    if (!snapshot) {
      throw new Error(`Snapshot ${String(snapshotId)} not found`);
    }

    const res = await fetch(`${this.apiBase}/load`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: snapshot.config,
    });

    if (!res.ok) {
      throw new Error(`Failed to rollback: ${res.statusText}`);
    }

    apiLogger.info('Rollback completed', { snapshotId });
  }

  async getSnapshots(db: Database): Promise<ProxySnapshot[]> {
    return db.prepare('SELECT * FROM proxy_snapshots ORDER BY id DESC LIMIT 10').all();
  }

  async ensureRouteForProject(
    domain: string,
    upstreamPort: number,
    existingRouteId?: string,
  ): Promise<string> {
    const routes = await this.getRoutes();

    if (existingRouteId) {
      const existing = routes.find((r) => r['@id'] === existingRouteId);
      if (existing) {
        const reverseProxy = existing.handle.find((h) => h.handler === 'reverse_proxy');
        const currentUpstream = reverseProxy?.upstreams?.[0]?.dial ?? '';
        const newUpstream = `localhost:${String(upstreamPort)}`;

        if (currentUpstream !== newUpstream) {
          await this.updateRoute(existingRouteId, domain, upstreamPort);
          apiLogger.info('Route updated via ensureRouteForProject', {
            routeId: existingRouteId,
            domain,
            upstreamPort,
          });
        }
        return existingRouteId;
      }
    }

    const byDomain = routes.find((r) => r.match[0]?.host?.[0] === domain);
    if (byDomain) {
      const reverseProxy = byDomain.handle.find((h) => h.handler === 'reverse_proxy');
      const currentUpstream = reverseProxy?.upstreams?.[0]?.dial ?? '';
      const newUpstream = `localhost:${String(upstreamPort)}`;

      if (currentUpstream !== newUpstream) {
        await this.updateRoute(byDomain['@id'], domain, upstreamPort);
        apiLogger.info('Route updated (by domain match) via ensureRouteForProject', {
          routeId: byDomain['@id'],
          domain,
          upstreamPort,
        });
      }
      return byDomain['@id'];
    }

    const newRouteId = await this.addRoute(domain, upstreamPort, true);
    apiLogger.info('Route created via ensureRouteForProject', {
      routeId: newRouteId,
      domain,
      upstreamPort,
    });
    return newRouteId;
  }
}

export const caddyService = new CaddyService();

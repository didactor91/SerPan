import pm2 from 'pm2';
import type { PM2Process, ProcessStatus } from '@serverctrl/shared';
import { apiLogger } from '../lib/logger.js';

export class PM2Service {
  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      pm2.connect((err) => {
        if (err as Error | null) {
          reject(err);
          return;
        }
        resolve();
      });
    });
  }

  async disconnect(): Promise<void> {
    pm2.disconnect();
  }

  async list(): Promise<PM2Process[]> {
    await this.connect();

    return new Promise((resolve, reject) => {
      pm2.list((err, list) => {
        if (err as Error | null) {
          reject(err);
          return;
        }

        const processes: PM2Process[] = list.map((proc) => ({
          name: proc.name ?? 'unknown',
          status: this.mapStatus(proc.pm2_env?.status),
          pid: proc.pid ?? 0,
          cpu: proc.monit?.cpu ?? 0,
          memory: proc.monit?.memory ?? 0,
          instances: typeof proc.pm2_env?.instances === 'number' ? proc.pm2_env.instances : 1,
          uptime: proc.pm2_env?.pm_uptime ? Date.now() - proc.pm2_env.pm_uptime : 0,
        }));

        resolve(processes);
      });
    });
  }

  async describe(name: string): Promise<PM2Process | null> {
    await this.connect();

    return new Promise((resolve) => {
      pm2.describe(name, (err, [proc]) => {
        if ((err as Error | null) || !proc) {
          resolve(null);
          return;
        }

        resolve({
          name: proc.name ?? 'unknown',
          status: this.mapStatus(proc.pm2_env?.status),
          pid: proc.pid ?? 0,
          cpu: proc.monit?.cpu ?? 0,
          memory: proc.monit?.memory ?? 0,
          instances: typeof proc.pm2_env?.instances === 'number' ? proc.pm2_env.instances : 1,
          uptime: proc.pm2_env?.pm_uptime ? Date.now() - proc.pm2_env.pm_uptime : 0,
        });
      });
    });
  }

  async start(nameOrScript: string): Promise<void> {
    await this.connect();

    return new Promise((resolve, reject) => {
      pm2.start(nameOrScript, (err) => {
        if (err as Error | null) reject(err);
        else resolve();
      });
    });
  }

  async stop(name: string): Promise<void> {
    await this.connect();

    return new Promise((resolve, reject) => {
      pm2.stop(name, (err) => {
        if (err as Error | null) reject(err);
        else resolve();
      });
    });
  }

  async restart(name: string): Promise<void> {
    await this.connect();

    return new Promise((resolve, reject) => {
      pm2.restart(name, (err) => {
        if (err as Error | null) reject(err);
        else resolve();
      });
    });
  }

  async reload(name: string): Promise<void> {
    await this.connect();

    return new Promise((resolve, reject) => {
      pm2.reload(name, (err) => {
        if (err as Error | null) reject(err);
        else resolve();
      });
    });
  }

  async scale(_name: string, _instances: number): Promise<void> {
    apiLogger.warn('PM2 scale not implemented - scale is not available in pm2 types');
  }

  async getLogs(name: string, lines = 100): Promise<string[]> {
    await this.connect();

    return new Promise((resolve, reject) => {
      const logs: string[] = [];

      pm2.launchBus((err) => {
        if (err as Error | null) {
          reject(err);
          return;
        }

        const handler = (data: unknown) => {
          const d = data as { name?: string; data?: string };
          if (d.name === name && d.data) {
            logs.push(d.data);
            if (logs.length > lines) {
              logs.shift();
            }
          }
        };

        (pm2 as unknown as { on: (event: string, cb: (data: unknown) => void) => void }).on(
          'log',
          handler,
        );

        setTimeout(() => {
          resolve(logs);
        }, 5000);
      });
    });
  }

  private mapStatus(status: string | undefined): ProcessStatus {
    switch (status) {
      case 'online':
      case 'launching':
      case 'errored':
      case 'stopped':
        return status;
      default:
        return 'unknown';
    }
  }
}

export const pm2Service = new PM2Service();

import osu from 'node-os-utils';
import type { SystemMetrics } from '@serverctrl/shared';
import { metricsLogger } from '../lib/logger.js';

/**
 * Converts a value to number, handling the case where node-os-utils
 * may return strings despite type definitions indicating numbers.
 */
function toNumber(value: unknown): number {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value);
    return Number.isNaN(parsed) ? 0 : parsed;
  }
  return 0;
}

export class SystemMetricsService {
  private intervals = new Map<string, NodeJS.Timeout>();

  async getSnapshot(): Promise<SystemMetrics> {
    const [cpu, mem, drive] = await Promise.all([
      osu.cpu.usage(),
      osu.mem.info(),
      osu.drive.info('/'),
    ]);

    return {
      cpu: {
        usage: toNumber(cpu),
      },
      memory: {
        total: toNumber(mem.totalMemMb),
        used: toNumber(mem.usedMemMb),
        free: toNumber(mem.freeMemMb),
        usagePercent: toNumber(mem.usedMemPercentage),
      },
      disk: {
        total: toNumber(drive.totalGb),
        used: toNumber(drive.usedGb),
        free: toNumber(drive.freeGb),
        usagePercent: toNumber(drive.usedPercentage),
      },
      timestamp: Date.now(),
    };
  }

  startPeriodicCollection(callback: (metrics: SystemMetrics) => void, intervalMs = 5000): void {
    const key = 'metrics-collection';

    // Clear existing interval if any
    this.stopPeriodicCollection(key);

    // Collect immediately
    void this.getSnapshot().then(callback);

    // Then collect periodically
    const interval = setInterval(async () => {
      try {
        const metrics = await this.getSnapshot();
        callback(metrics);
      } catch (error) {
        metricsLogger.error('Collection error', {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }, intervalMs);

    this.intervals.set(key, interval);
  }

  stopPeriodicCollection(key: string): void {
    const interval = this.intervals.get(key);
    if (interval) {
      clearInterval(interval);
      this.intervals.delete(key);
    }
  }

  stopAllCollections(): void {
    for (const key of this.intervals.keys()) {
      this.stopPeriodicCollection(key);
    }
  }
}

export const systemMetricsService = new SystemMetricsService();

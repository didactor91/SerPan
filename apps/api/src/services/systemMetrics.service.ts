import osu from 'node-os-utils';
import type { SystemMetrics } from '@serverctrl/shared';
import { metricsLogger } from '../lib/logger.js';

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
        usage: cpu,
      },
      memory: {
        total: mem.totalMemMb,
        used: mem.usedMemMb,
        free: mem.freeMemMb,
        usagePercent: mem.usedMemPercentage,
      },
      disk: {
        total: drive.totalGb,
        used: drive.usedGb,
        free: drive.freeGb,
        usagePercent: drive.usedPercentage,
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

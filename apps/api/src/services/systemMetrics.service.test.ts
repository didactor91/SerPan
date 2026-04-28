import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SystemMetricsService } from './systemMetrics.service.js';

// Mock node-os-utils
vi.mock('node-os-utils', () => ({
  default: {
    cpu: { usage: vi.fn().mockResolvedValue(45.5) },
    mem: {
      info: vi.fn().mockResolvedValue({
        totalMemMb: 16384,
        usedMemMb: 8192,
        freeMemMb: 8192,
        usedMemPercentage: 50,
      }),
    },
    drive: {
      info: vi.fn().mockResolvedValue({
        totalGb: 500,
        usedGb: 250,
        freeGb: 250,
        usedPercentage: 50,
      }),
    },
  },
}));

describe('SystemMetricsService', () => {
  let metricsService: SystemMetricsService;

  beforeEach(() => {
    vi.clearAllMocks();
    metricsService = new SystemMetricsService();
  });

  describe('getSnapshot', () => {
    it('should return system metrics', async () => {
      const snapshot = await metricsService.getSnapshot();

      expect(snapshot).toMatchObject({
        cpu: { usage: 45.5 },
        memory: {
          total: 16384,
          used: 8192,
          free: 8192,
          usagePercent: 50,
        },
        disk: {
          total: 500,
          used: 250,
          free: 250,
          usagePercent: 50,
        },
      });
      expect(typeof snapshot.timestamp).toBe('number');
    });
  });
});

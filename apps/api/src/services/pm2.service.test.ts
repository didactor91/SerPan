import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock pm2 module
vi.mock('pm2', () => ({
  default: {
    connect: vi.fn((cb) => cb(null)),
    disconnect: vi.fn((cb) => cb?.()),
    list: vi.fn((cb) =>
      cb(null, [
        {
          name: 'test-app',
          pid: 1234,
          pm2_env: { status: 'online', instances: 1, pm_uptime: Date.now() - 3600000 },
          monit: { cpu: 5.5, memory: 256000000 },
        },
      ]),
    ),
    describe: vi.fn((name, cb) =>
      cb(null, [
        {
          name,
          pid: 1234,
          pm2_env: { status: 'online', instances: 1, pm_uptime: Date.now() - 3600000 },
          monit: { cpu: 5.5, memory: 256000000 },
        },
      ]),
    ),
    start: vi.fn((name, cb) => cb(null)),
    stop: vi.fn((name, cb) => cb(null)),
    restart: vi.fn((name, cb) => cb(null)),
    reload: vi.fn((name, cb) => cb(null)),
    scale: vi.fn((name, instances, cb) => cb(null)),
  },
}));

import { PM2Service } from './pm2.service';

describe('PM2Service', () => {
  let pm2Service: PM2Service;

  beforeEach(async () => {
    vi.clearAllMocks();
    pm2Service = new PM2Service();
    await pm2Service.connect();
  });

  describe('connect', () => {
    it('should connect to PM2', async () => {
      const pm2Service = new PM2Service();
      await expect(pm2Service.connect()).resolves.toBeUndefined();
    });
  });

  describe('list', () => {
    it('should return list of processes', async () => {
      const processes = await pm2Service.list();

      expect(processes).toHaveLength(1);
      expect(processes[0].name).toBe('test-app');
      expect(processes[0].status).toBe('online');
      expect(processes[0].pid).toBe(1234);
      expect(processes[0].cpu).toBe(5.5);
      expect(processes[0].memory).toBe(256000000);
    });
  });

  describe('describe', () => {
    it('should return process description', async () => {
      const process = await pm2Service.describe('test-app');

      expect(process).not.toBeNull();
      expect(process?.name).toBe('test-app');
      expect(process?.status).toBe('online');
    });

    it('should return null for non-existent process', async () => {
      const pm2 = await import('pm2');
      vi.spyOn(pm2.default, 'describe').mockImplementationOnce((_name, cb) => { cb(null, []); });

      const process = await pm2Service.describe('non-existent');
      expect(process).toBeNull();
    });
  });

  describe('start', () => {
    it('should start a process', async () => {
      await expect(pm2Service.start('test-app')).resolves.toBeUndefined();
    });
  });

  describe('stop', () => {
    it('should stop a process', async () => {
      await expect(pm2Service.stop('test-app')).resolves.toBeUndefined();
    });
  });

  describe('restart', () => {
    it('should restart a process', async () => {
      await expect(pm2Service.restart('test-app')).resolves.toBeUndefined();
    });
  });

  describe('scale', () => {
    it('should scale a process', async () => {
      await expect(pm2Service.scale('test-app', 4)).resolves.toBeUndefined();
    });
  });
});

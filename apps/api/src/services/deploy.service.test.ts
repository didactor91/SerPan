import { describe, it, expect } from 'vitest';
import { parseDeployScript } from './deploy.service.js';

describe('DeployService', () => {
  describe('parseDeployScript', () => {
    it('should return empty result for empty script', () => {
      const result = parseDeployScript('');
      expect(result.buildCmd).toBe('');
      expect(result.restartCmd).toBeNull();
    });

    it('should return empty result for whitespace-only script', () => {
      const result = parseDeployScript('   \n  ');
      expect(result.buildCmd).toBe('');
      expect(result.restartCmd).toBeNull();
    });

    it('should handle single command without &&', () => {
      const result = parseDeployScript('npm run build');
      expect(result.buildCmd).toBe('npm run build');
      expect(result.restartCmd).toBeNull();
    });

    it('should split on && and treat last part as restart', () => {
      const result = parseDeployScript('npm install && npm run build && pm2 restart myapp');
      expect(result.buildCmd).toBe('npm install && npm run build');
      expect(result.restartCmd).toBe('pm2 restart myapp');
    });

    it('should handle two commands (one build, one restart)', () => {
      const result = parseDeployScript('pnpm build && pm2 restart api');
      expect(result.buildCmd).toBe('pnpm build');
      expect(result.restartCmd).toBe('pm2 restart api');
    });

    it('should trim whitespace from commands', () => {
      const result = parseDeployScript('  npm install  &&  npm run build  ');
      expect(result.buildCmd).toBe('npm install');
      expect(result.restartCmd).toBe('npm run build');
    });

    it('should handle multiple && with restart as last', () => {
      const result = parseDeployScript('npm ci && npm run lint && npm run build && pm2 restart');
      expect(result.buildCmd).toBe('npm ci && npm run lint && npm run build');
      expect(result.restartCmd).toBe('pm2 restart');
    });

    it('should treat single command with trailing && as having no restart', () => {
      const result = parseDeployScript('npm run build &&');
      expect(result.buildCmd).toBe('npm run build');
      expect(result.restartCmd).toBeNull();
    });
  });
});

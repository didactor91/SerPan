import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AuthService } from './auth.service';

// Mock getEnv
vi.mock('../config/env.js', () => ({
  getEnv: () => ({
    JWT_SECRET: 'test-secret-key-that-is-32-chars-long!!',
    JWT_REFRESH_SECRET: 'test-refresh-secret-key-32-chars!!',
  }),
}));

describe('AuthService', () => {
  let authService: AuthService;

  beforeEach(() => {
    authService = new AuthService();
  });

  describe('hashPassword', () => {
    it('should hash a password', async () => {
      const password = 'testpassword123';
      const hash = await authService.hashPassword(password);

      expect(hash).not.toBe(password);
      expect(hash.length).toBeGreaterThan(0);
    });

    it('should produce different hashes for same password', async () => {
      const password = 'testpassword123';
      const hash1 = await authService.hashPassword(password);
      const hash2 = await authService.hashPassword(password);

      expect(hash1).not.toBe(hash2);
    });
  });

  describe('verifyPassword', () => {
    it('should return true for correct password', async () => {
      const password = 'testpassword123';
      const hash = await authService.hashPassword(password);

      const isValid = await authService.verifyPassword(password, hash);
      expect(isValid).toBe(true);
    });

    it('should return false for incorrect password', async () => {
      const password = 'testpassword123';
      const hash = await authService.hashPassword(password);

      const isValid = await authService.verifyPassword('wrongpassword', hash);
      expect(isValid).toBe(false);
    });
  });

  describe('createAccessToken', () => {
    it('should create a valid access token', () => {
      const user = { id: 1, username: 'testuser', createdAt: new Date().toISOString() };

      const token = authService.createAccessToken(user);

      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(token.split('.').length).toBe(3); // JWT has 3 parts
    });
  });

  describe('verifyAccessToken', () => {
    it('should verify a valid token', () => {
      const user = { id: 1, username: 'testuser', createdAt: new Date().toISOString() };
      const token = authService.createAccessToken(user);

      const payload = authService.verifyAccessToken(token);

      expect(payload.userId).toBe(1);
      expect(payload.username).toBe('testuser');
    });

    it('should throw for invalid token', () => {
      expect(() => {
        authService.verifyAccessToken('invalid-token');
      }).toThrow();
    });
  });

  describe('createRefreshToken', () => {
    it('should create a refresh token', () => {
      const user = { id: 1, username: 'testuser', createdAt: new Date().toISOString() };

      const token = authService.createRefreshToken(user);

      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
    });
  });

  describe('decodeToken', () => {
    it('should decode a token without verifying', () => {
      const user = { id: 1, username: 'testuser', createdAt: new Date().toISOString() };
      const token = authService.createAccessToken(user);

      const payload = authService.decodeToken(token);

      expect(payload?.userId).toBe(1);
      expect(payload?.username).toBe('testuser');
    });

    it('should return null for invalid token', () => {
      const payload = authService.decodeToken('invalid-token');
      expect(payload).toBeNull();
    });
  });
});

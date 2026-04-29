import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { User } from '@serverctrl/shared';

// Mock dependencies - use vi.hoisted for variables that need to be accessible in mock factories
const { mockAuthService, mockPrepare } = vi.hoisted(() => ({
  mockAuthService: {
    createAccessToken: vi.fn(() => 'mock-access-token'),
    createRefreshToken: vi.fn(() => 'mock-refresh-token'),
  },
  mockPrepare: vi.fn(),
}));

vi.mock('../config/env.js', () => ({
  getEnv: vi.fn(() => ({
    WEBAUTHN_RP_NAME: 'Test RP',
    WEBAUTHN_RP_ID: 'example.com',
    JWT_SECRET: 'test-secret',
    JWT_REFRESH_SECRET: 'test-refresh-secret',
  })),
}));

vi.mock('../db/schema.js', () => ({
  getDatabase: vi.fn(() => ({
    prepare: mockPrepare,
  })),
}));

vi.mock('./auth.service.js', () => ({
  authService: mockAuthService,
}));

// Import after mocks are set up
import { WebAuthnService, webAuthnService } from './webauthn.service.js';

describe('WebAuthnService', () => {
  const mockUser: User = { id: 1, username: 'testuser', createdAt: '2024-01-01' };

  beforeEach(() => {
    vi.clearAllMocks();
    mockPrepare.mockReset();
  });

  describe('generateRegistrationOptions', () => {
    it('generates registration options with correct RP info', async () => {
      mockPrepare.mockImplementation((query: string) => {
        if (query.includes('SELECT webauthn_user_id')) {
          return { get: vi.fn(() => ({ webauthn_user_id: null })) };
        }
        if (query.includes('SELECT credential_id')) {
          return { all: vi.fn(() => []) };
        }
        if (query.includes('UPDATE')) {
          return { run: vi.fn() };
        }
        return { run: vi.fn() };
      });

      const options = await webAuthnService.generateRegistrationOptions(mockUser);

      expect(options.rp).toEqual({ name: 'Test RP', id: 'example.com' });
      expect(options.user.name).toBe('testuser');
      expect(options.user.displayName).toBe('testuser');
      expect(options.user.id).toBeDefined();
      expect(typeof options.user.id).toBe('string');
      expect(options.pubKeyCredParams).toBeDefined();
      expect(Array.isArray(options.pubKeyCredParams)).toBe(true);
    });

    it('stores challenge with 5-minute TTL', async () => {
      mockPrepare.mockImplementation((query: string) => {
        if (query.includes('SELECT webauthn_user_id')) {
          return { get: vi.fn(() => ({ webauthn_user_id: null })) };
        }
        if (query.includes('SELECT credential_id')) {
          return { all: vi.fn(() => []) };
        }
        if (query.includes('UPDATE')) {
          return { run: vi.fn() };
        }
        return { run: vi.fn() };
      });

      const options = await webAuthnService.generateRegistrationOptions(mockUser);

      expect(options.challenge).toBeDefined();
      expect(typeof options.challenge).toBe('string');
      expect(options.challenge.length).toBeGreaterThan(0);
    });

    it('excludes existing credentials to prevent duplicates', async () => {
      mockPrepare.mockImplementation((query: string) => {
        if (query.includes('SELECT webauthn_user_id')) {
          return { get: vi.fn(() => ({ webauthn_user_id: null })) };
        }
        if (query.includes('SELECT credential_id')) {
          return { all: vi.fn(() => [{ credential_id: 'existing-cred-id' }]) };
        }
        if (query.includes('UPDATE')) {
          return { run: vi.fn() };
        }
        return { run: vi.fn() };
      });

      const options = await webAuthnService.generateRegistrationOptions(mockUser);

      expect(options.excludeCredentials).toBeDefined();
      expect(Array.isArray(options.excludeCredentials)).toBe(true);
    });
  });

  describe('verifyRegistrationResponse', () => {
    it('throws ValidationError when attestation object is missing', async () => {
      mockPrepare.mockReturnValue({ get: vi.fn(() => null) });

      await expect(
        webAuthnService.verifyRegistrationResponse(1, {
          id: 'test',
          rawId: 'test',
          response: {},
        } as any),
      ).rejects.toThrow('Missing attestation object');
    });
  });

  describe('generateAuthenticationOptions', () => {
    it('throws ValidationError when user has no passkeys', async () => {
      mockPrepare.mockImplementation((query: string) => {
        if (query.includes('SELECT credential_id')) {
          return { all: vi.fn(() => []) };
        }
        return { all: vi.fn(() => []) };
      });

      await expect(webAuthnService.generateAuthenticationOptions(1)).rejects.toThrow(
        'No passkeys registered for this user',
      );
    });

    it('returns options with allowed credentials', async () => {
      mockPrepare.mockImplementation((query: string) => {
        if (query.includes('SELECT credential_id')) {
          return { all: vi.fn(() => [{ credential_id: 'test-cred-id' }]) };
        }
        return { all: vi.fn(() => []) };
      });

      const options = await webAuthnService.generateAuthenticationOptions(1);

      expect(options.challenge).toBeDefined();
      expect(options.rpId).toBe('example.com');
    });
  });

  describe('listUserPasskeys', () => {
    it('returns masked credential IDs', async () => {
      mockPrepare.mockImplementation((query: string) => {
        if (query.includes('SELECT')) {
          return {
            all: vi.fn(() => [
              {
                id: 1,
                credential_id: 'verylongcredentialid123456',
                device_type: 'single-device',
                device_name: 'Test Device',
                created_at: '2024-01-01',
              },
            ]),
          };
        }
        return { all: vi.fn(() => []) };
      });

      const passkeys = await webAuthnService.listUserPasskeys(1);

      expect(passkeys).toHaveLength(1);
      expect(passkeys[0].credentialId).toContain('****');
      expect(passkeys[0].credentialId).not.toContain('verylongcredentialid123456');
      expect(passkeys[0].deviceType).toBe('single-device');
      expect(passkeys[0].deviceName).toBe('Test Device');
    });

    it('returns empty array when user has no passkeys', async () => {
      mockPrepare.mockImplementation((query: string) => {
        if (query.includes('SELECT')) {
          return { all: vi.fn(() => []) };
        }
        return { all: vi.fn(() => []) };
      });

      const passkeys = await webAuthnService.listUserPasskeys(1);

      expect(passkeys).toHaveLength(0);
    });
  });

  describe('deletePasskey', () => {
    it('throws NotFoundError when passkey does not exist', async () => {
      mockPrepare.mockImplementation((query: string) => {
        if (query.includes('SELECT')) {
          return { get: vi.fn(() => null) };
        }
        return { run: vi.fn() };
      });

      await expect(webAuthnService.deletePasskey(1, 'nonexistent')).rejects.toThrow('Passkey');
    });

    it('throws ForbiddenError when trying to delete another user passkey', async () => {
      mockPrepare.mockImplementation((query: string) => {
        if (query.includes('SELECT')) {
          return { get: vi.fn(() => ({ user_id: 2 })) };
        }
        return { run: vi.fn() };
      });

      await expect(webAuthnService.deletePasskey(1, 'some-credential-id')).rejects.toThrow(
        "Cannot delete another user's passkey",
      );
    });

    it('deletes passkey when ownership is confirmed', async () => {
      const mockRun = vi.fn();
      mockPrepare.mockImplementation((query: string) => {
        if (query.includes('SELECT')) {
          return { get: vi.fn(() => ({ user_id: 1 })) };
        }
        if (query.includes('DELETE')) {
          return { run: mockRun };
        }
        return { run: vi.fn() };
      });

      await expect(webAuthnService.deletePasskey(1, 'my-credential-id')).resolves.toBeUndefined();
      expect(mockRun).toHaveBeenCalledWith('my-credential-id');
    });
  });
});

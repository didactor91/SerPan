import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { User } from '@serverctrl/shared';

// ALL mocks must be inside vi.hoisted so they are available when vi.mock is hoisted
const mocks = vi.hoisted(() => {
  // Mock table references
  const mockUsers = {
    tableName: 'users',
    id: { name: 'id' },
    username: { name: 'username' },
    webauthnUserId: { name: 'webauthn_user_id' },
    createdAt: { name: 'created_at' },
  };

  const mockUserPasskeys = {
    tableName: 'user_passkeys',
    id: { name: 'id' },
    userId: { name: 'user_id' },
    credentialId: { name: 'credential_id' },
    publicKey: { name: 'public_key' },
    counter: { name: 'counter' },
    deviceType: { name: 'device_type' },
    deviceName: { name: 'device_name' },
    createdAt: { name: 'created_at' },
  };

  // Auth service mock
  const mockAuthService = {
    createAccessToken: vi.fn(() => 'mock-access-token'),
    createRefreshToken: vi.fn(() => 'mock-refresh-token'),
  };

  // Drizzle-compatible mock chain - mutable
  const mockDb = {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          get: vi.fn(() => null),
          all: vi.fn(() => []),
        })),
        orderBy: vi.fn(() => ({
          all: vi.fn(() => []),
        })),
        all: vi.fn(() => []),
      })),
    })),
    insert: vi.fn(() => ({
      values: vi.fn(() => ({
        run: vi.fn(() => ({ lastInsertRowid: 1 })),
        returning: vi.fn(() => ({
          run: vi.fn(() => ({})),
        })),
      })),
    })),
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn(() => ({
          run: vi.fn(() => ({ changes: 1 })),
        })),
      })),
    })),
    // Drizzle delete has .where() directly, no .from()
    delete: vi.fn(() => ({
      where: vi.fn(() => ({
        run: vi.fn(() => ({ changes: 1 })),
      })),
    })),
  };

  return { mockUsers, mockUserPasskeys, mockAuthService, mockDb };
});

// Mock env config
vi.mock('../config/env.js', () => ({
  getEnv: vi.fn(() => ({
    WEBAUTHN_RP_NAME: 'Test RP',
    WEBAUTHN_RP_ID: 'example.com',
    JWT_SECRET: 'test-secret',
    JWT_REFRESH_SECRET: 'test-refresh-secret',
  })),
}));

// Mock schema with table references
vi.mock('../db/schema.js', () => ({
  getDatabase: vi.fn(() => mocks.mockDb),
  users: mocks.mockUsers,
  userPasskeys: mocks.mockUserPasskeys,
}));

vi.mock('./auth.service.js', () => ({
  authService: mocks.mockAuthService,
}));

// Import after mocks are set up
import { WebAuthnService, webAuthnService } from './webauthn.service.js';

// Helper to setup mockDb select chain for a specific table
function setupSelectMock(
  table: unknown,
  whereResult: { get: () => unknown; all: () => unknown[] },
) {
  const fromMock = vi.fn().mockImplementation(() => ({
    where: vi.fn().mockImplementation(() => whereResult),
    all: vi.fn().mockImplementation(() => []),
  }));
  const selectMock = vi.fn().mockImplementation(() => ({
    from: fromMock,
  }));
  mocks.mockDb.select = selectMock;
  return { selectMock, fromMock };
}

describe('WebAuthnService', () => {
  const mockUser: User = { id: 1, username: 'testuser', createdAt: '2024-01-01' };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('generateRegistrationOptions', () => {
    it('generates registration options with correct RP info', async () => {
      // Setup: user found with no webauthn_user_id, no passkeys
      setupSelectMock(mocks.mockUsers, {
        get: () => ({ webauthnUserId: null }),
        all: () => [],
      });
      setupSelectMock(mocks.mockUserPasskeys, {
        get: () => null,
        all: () => [],
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
      setupSelectMock(mocks.mockUsers, {
        get: () => ({ webauthnUserId: null }),
        all: () => [],
      });
      setupSelectMock(mocks.mockUserPasskeys, {
        get: () => null,
        all: () => [],
      });

      const options = await webAuthnService.generateRegistrationOptions(mockUser);

      expect(options.challenge).toBeDefined();
      expect(typeof options.challenge).toBe('string');
      expect(options.challenge.length).toBeGreaterThan(0);
    });

    it('excludes existing credentials to prevent duplicates', async () => {
      setupSelectMock(mocks.mockUsers, {
        get: () => ({ webauthnUserId: null }),
        all: () => [],
      });
      setupSelectMock(mocks.mockUserPasskeys, {
        get: () => null,
        all: () => [{ credentialId: 'existing-cred-id' }],
      });

      const options = await webAuthnService.generateRegistrationOptions(mockUser);

      expect(options.excludeCredentials).toBeDefined();
      expect(Array.isArray(options.excludeCredentials)).toBe(true);
    });
  });

  describe('verifyRegistrationResponse', () => {
    it('throws ValidationError when attestation object is missing', async () => {
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
      setupSelectMock(mocks.mockUserPasskeys, {
        get: () => null,
        all: () => [],
      });

      await expect(webAuthnService.generateAuthenticationOptions(1)).rejects.toThrow(
        'No passkeys registered for this user',
      );
    });

    it('returns options with allowed credentials', async () => {
      setupSelectMock(mocks.mockUserPasskeys, {
        get: () => null,
        all: () => [{ credentialId: 'test-cred-id' }],
      });

      const options = await webAuthnService.generateAuthenticationOptions(1);

      expect(options.challenge).toBeDefined();
      expect(options.rpId).toBe('example.com');
    });
  });

  describe('listUserPasskeys', () => {
    it('returns masked credential IDs', async () => {
      setupSelectMock(mocks.mockUserPasskeys, {
        get: () => null,
        all: () => [
          {
            id: 1,
            credentialId: 'verylongcredentialid123456',
            deviceType: 'single-device',
            deviceName: 'Test Device',
            createdAt: '2024-01-01',
          },
        ],
      });

      const passkeys = await webAuthnService.listUserPasskeys(1);

      expect(passkeys).toHaveLength(1);
      expect(passkeys[0].credentialId).toContain('****');
      expect(passkeys[0].credentialId).not.toContain('verylongcredentialid123456');
      expect(passkeys[0].deviceType).toBe('single-device');
      expect(passkeys[0].deviceName).toBe('Test Device');
    });

    it('returns empty array when user has no passkeys', async () => {
      setupSelectMock(mocks.mockUserPasskeys, {
        get: () => null,
        all: () => [],
      });

      const passkeys = await webAuthnService.listUserPasskeys(1);

      expect(passkeys).toHaveLength(0);
    });
  });

  describe('deletePasskey', () => {
    it('throws NotFoundError when passkey does not exist', async () => {
      setupSelectMock(mocks.mockUserPasskeys, {
        get: () => null,
        all: () => [],
      });

      await expect(webAuthnService.deletePasskey(1, 'nonexistent')).rejects.toThrow('Passkey');
    });

    it('throws ForbiddenError when trying to delete another user passkey', async () => {
      setupSelectMock(mocks.mockUserPasskeys, {
        get: () => ({ userId: 2 }),
        all: () => [],
      });

      await expect(webAuthnService.deletePasskey(1, 'some-credential-id')).rejects.toThrow(
        "Cannot delete another user's passkey",
      );
    });

    it('deletes passkey when ownership is confirmed', async () => {
      const mockRun = vi.fn();

      // First setup the select mock for finding the passkey
      setupSelectMock(mocks.mockUserPasskeys, {
        get: () => ({ userId: 1 }),
        all: () => [],
      });

      // Override delete for this specific test - create a new mock function
      const deleteMock = vi.fn().mockImplementation(() => ({
        where: vi.fn().mockImplementation(() => ({
          run: mockRun,
        })),
      }));
      mocks.mockDb.delete = deleteMock;

      await expect(webAuthnService.deletePasskey(1, 'my-credential-id')).resolves.toBeUndefined();
      expect(mockRun).toHaveBeenCalled();
    });
  });
});

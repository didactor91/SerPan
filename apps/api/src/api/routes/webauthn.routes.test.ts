import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import cookieParser from 'cookie-parser';

// Mock dependencies before importing routes
vi.mock('../../services/auth.service.js', () => ({
  authService: {
    createAccessToken: vi.fn(() => 'test-access-token'),
    createRefreshToken: vi.fn(() => 'test-refresh-token'),
    verifyAccessToken: vi.fn().mockReturnValue({ userId: 1, username: 'testuser' }),
  },
}));

vi.mock('../../db/schema.js', () => ({
  getDatabase: () => ({
    prepare: vi.fn().mockReturnValue({
      get: vi.fn().mockReturnValue({
        id: 1,
        username: 'testuser',
        password_hash: 'hashed_password',
        webauthn_user_id: null,
        created_at: '2024-01-01T00:00:00.000Z',
        last_login: null,
      }),
      run: vi.fn(),
      all: vi.fn().mockReturnValue([]),
    }),
  }),
}));

describe('WebAuthn Routes', () => {
  let app: express.Application;

  beforeEach(async () => {
    vi.clearAllMocks();

    app = express();
    app.use(express.json());
    app.use(cookieParser());

    const { default: webauthnRoutes } = await import('./webauthn.routes.js');
    app.use('/auth/webauthn', webauthnRoutes);

    // Error handler
    app.use(
      (err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
        if ('statusCode' in err) {
          res.status((err as { statusCode: number }).statusCode).json({
            error: {
              code: (err as { code: string }).code,
              message: err.message,
              statusCode: (err as { statusCode: number }).statusCode,
            },
          });
        } else {
          res.status(500).json({ error: { message: err.message } });
        }
      },
    );
  });

  describe('POST /auth/webauthn/register/options', () => {
    it('returns 401 if not authenticated', async () => {
      const response = await request(app).post('/auth/webauthn/register/options').send({});

      expect(response.status).toBe(401);
    });
  });

  describe('POST /auth/webauthn/register/verify', () => {
    it('returns 401 if not authenticated', async () => {
      const response = await request(app)
        .post('/auth/webauthn/register/verify')
        .send({ response: {} });

      expect(response.status).toBe(401);
    });
  });

  describe('POST /auth/webauthn/authentication/options', () => {
    it('returns 400 if userId is missing', async () => {
      const response = await request(app).post('/auth/webauthn/authentication/options').send({});

      expect(response.status).toBe(400);
      expect(response.body.error.message).toBe('userId is required');
    });
  });

  describe('POST /auth/webauthn/authentication/verify', () => {
    it('returns 400 if userId is missing', async () => {
      const response = await request(app)
        .post('/auth/webauthn/authentication/verify')
        .send({ response: {} });

      expect(response.status).toBe(400);
      expect(response.body.error.message).toBe('userId and response are required');
    });

    it('returns 400 if response is missing', async () => {
      const response = await request(app)
        .post('/auth/webauthn/authentication/verify')
        .send({ userId: 1 });

      expect(response.status).toBe(400);
      expect(response.body.error.message).toBe('userId and response are required');
    });
  });

  describe('GET /auth/webauthn/passkeys', () => {
    it('returns 401 if not authenticated', async () => {
      const response = await request(app).get('/auth/webauthn/passkeys');

      expect(response.status).toBe(401);
    });
  });

  describe('DELETE /auth/webauthn/passkeys/:credentialId', () => {
    it('returns 401 if not authenticated', async () => {
      const response = await request(app).delete('/auth/webauthn/passkeys/some-credential-id');

      expect(response.status).toBe(401);
    });
  });
});

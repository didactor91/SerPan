import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import cookieParser from 'cookie-parser';

// Mock dependencies before importing routes
vi.mock('../../services/auth.service.js', () => ({
  authService: {
    hashPassword: vi.fn().mockResolvedValue('hashed_password'),
    verifyPassword: vi.fn().mockResolvedValue(true),
    createAccessToken: vi.fn().mockReturnValue('test-access-token'),
    createRefreshToken: vi.fn().mockReturnValue('test-refresh-token'),
    verifyAccessToken: vi.fn().mockReturnValue({ userId: 1, username: 'testuser' }),
    verifyRefreshToken: vi.fn().mockReturnValue({ userId: 1, username: 'testuser' }),
  },
}));

// Mock schema with Drizzle-compatible interface
const mockDb = {
  select: () => ({
    from: (table: unknown) => ({
      where: (condition: unknown) => ({
        get: vi.fn(() => ({
          id: 1,
          username: 'testuser',
          passwordHash: 'hashed_password',
          createdAt: '2024-01-01T00:00:00.000Z',
          lastLogin: null,
        })),
      }),
    }),
  }),
  update: (table: unknown) => ({
    set: (data: unknown) => ({
      where: (condition: unknown) => ({
        run: vi.fn(() => ({ changes: 1 })),
      }),
    }),
  }),
};

// Create mock table references
const mockUsers = {
  tableName: 'users',
  id: { name: 'id' },
  username: { name: 'username' },
  passwordHash: { name: 'password_hash' },
  webauthnUserId: { name: 'webauthn_user_id' },
  createdAt: { name: 'created_at' },
  lastLogin: { name: 'last_login' },
};

vi.mock('../../db/schema.js', () => ({
  getDatabase: vi.fn(() => mockDb),
  users: mockUsers,
}));

describe('Auth Routes', () => {
  let app: express.Application;

  beforeEach(async () => {
    vi.clearAllMocks();

    app = express();
    app.use(express.json());
    app.use(cookieParser());

    const { default: authRoutes } = await import('./auth.routes.js');
    app.use('/auth', authRoutes);

    // Error handler - catches async errors
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

  describe('POST /auth/login', () => {
    it('should return 400 if username is missing', async () => {
      const res = await request(app).post('/auth/login').send({ password: 'password123' });

      expect(res.status).toBe(400);
    });

    it('should return 400 if password is missing', async () => {
      const res = await request(app).post('/auth/login').send({ username: 'testuser' });

      expect(res.status).toBe(400);
    });

    it('should return 401 for invalid credentials', async () => {
      const { authService } = await import('../../services/auth.service.js');
      vi.mocked(authService.verifyPassword).mockResolvedValueOnce(false);

      const res = await request(app)
        .post('/auth/login')
        .send({ username: 'testuser', password: 'wrongpassword' });

      expect(res.status).toBe(401);
    });

    it('should return tokens on successful login', async () => {
      const res = await request(app)
        .post('/auth/login')
        .send({ username: 'testuser', password: 'password123' });

      expect(res.status).toBe(200);
      expect(res.body.data.user.username).toBe('testuser');
      expect(res.headers['set-cookie']).toBeDefined();
    });
  });

  describe('POST /auth/logout', () => {
    it('should clear cookies and return success', async () => {
      const res = await request(app).post('/auth/logout');

      expect(res.status).toBe(200);
      expect(res.body.data.message).toBe('Logged out successfully');
    });
  });

  describe('GET /auth/me', () => {
    it('should return 401 if not authenticated', async () => {
      const res = await request(app).get('/auth/me');

      expect(res.status).toBe(401);
    });
  });
});

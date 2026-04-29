import { Router, type Router as ExpressRouter } from 'express';
import type { Request, Response } from 'express';
import { authService } from '../../services/auth.service.js';
import { getDatabase } from '../../db/schema.js';
import { optionalAuth } from '../../middleware/auth.middleware.js';
import {
  UnauthorizedError,
  ValidationError,
  RateLimitError,
} from '../../middleware/errorHandler.js';

interface LoginBody {
  username?: unknown;
  password?: unknown;
}

const router: ExpressRouter = Router();

// Rate limiting store (simple in-memory, per-IP)
const loginAttempts = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 5;
const RATE_WINDOW_MS = 15 * 60 * 1000; // 15 minutes

function checkRateLimit(ip: string): void {
  const now = Date.now();
  const attempt = loginAttempts.get(ip);

  if (!attempt || now > attempt.resetAt) {
    loginAttempts.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return;
  }

  if (attempt.count >= RATE_LIMIT) {
    throw new RateLimitError();
  }

  attempt.count++;
}

// POST /auth/login
router.post('/login', async (req: Request, res: Response, next) => {
  try {
    const ip = req.ip ?? 'unknown';
    checkRateLimit(ip);

    const { username, password } = req.body as LoginBody;

    if (!username || typeof username !== 'string' || !password || typeof password !== 'string') {
      next(new ValidationError('Username and password are required'));
      return;
    }

    const db = getDatabase();
    const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username) as
      | {
          id: number;
          username: string;
          password_hash: string;
          created_at: string;
          last_login?: string;
        }
      | undefined;

    if (!user) {
      next(new UnauthorizedError('Invalid credentials'));
      return;
    }

    const validPassword = await authService.verifyPassword(password, user.password_hash);

    if (!validPassword) {
      next(new UnauthorizedError('Invalid credentials'));
      return;
    }

    // Update last login
    db.prepare("UPDATE users SET last_login = datetime('now') WHERE id = ?").run(user.id);

    const userForToken: import('@serverctrl/shared').User = {
      id: user.id,
      username: user.username,
      createdAt: user.created_at,
    };
    if (user.last_login) {
      userForToken.lastLogin = user.last_login;
    }

    const accessToken = authService.createAccessToken(userForToken);
    const refreshToken = authService.createRefreshToken(userForToken);

    // Set cookies
    res.cookie('accessToken', accessToken, {
      httpOnly: true,
      sameSite: 'strict',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 8 * 60 * 60 * 1000, // 8 hours
    });

    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      sameSite: 'strict',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    });

    res.json({
      data: {
        user: {
          id: user.id,
          username: user.username,
          createdAt: user.created_at,
          lastLogin: user.last_login,
        },
      },
    });
  } catch (error) {
    if (error instanceof RateLimitError) {
      res.status(429).json({
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: 'Too many login attempts, please try again in 15 minutes',
          statusCode: 429,
        },
      });
      return;
    }
    next(error);
    return;
  }
});

// POST /auth/logout
router.post('/logout', (_req: Request, res: Response) => {
  res.clearCookie('accessToken');
  res.clearCookie('refreshToken');
  res.json({ data: { message: 'Logged out successfully' } });
});

// POST /auth/refresh
router.post('/refresh', async (req: Request, res: Response) => {
  const refreshToken = req.cookies.refreshToken as string | undefined;

  if (!refreshToken) {
    res.status(401).json({
      error: {
        code: 'AUTH_NO_REFRESH_TOKEN',
        message: 'No refresh token provided',
        statusCode: 401,
      },
    });
    return;
  }

  try {
    const payload = authService.verifyRefreshToken(refreshToken);

    const db = getDatabase();
    const user = db
      .prepare('SELECT id, username, created_at, last_login FROM users WHERE id = ?')
      .get(payload.userId) as
      | {
          id: number;
          username: string;
          created_at: string;
          last_login?: string;
        }
      | undefined;

    if (!user) {
      res.status(401).json({
        error: {
          code: 'AUTH_USER_NOT_FOUND',
          message: 'User not found',
          statusCode: 401,
        },
      });
      return;
    }

    const userForToken: import('@serverctrl/shared').User = {
      id: user.id,
      username: user.username,
      createdAt: user.created_at,
    };
    if (user.last_login) {
      userForToken.lastLogin = user.last_login;
    }

    const newAccessToken = authService.createAccessToken(userForToken);
    const newRefreshToken = authService.createRefreshToken(userForToken);

    // Set new cookies
    res.cookie('accessToken', newAccessToken, {
      httpOnly: true,
      sameSite: 'strict',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 8 * 60 * 60 * 1000, // 8 hours
    });

    res.cookie('refreshToken', newRefreshToken, {
      httpOnly: true,
      sameSite: 'strict',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    });

    res.json({
      data: {
        user: {
          id: user.id,
          username: user.username,
          createdAt: user.created_at,
          lastLogin: user.last_login,
        },
      },
    });
  } catch {
    res.status(401).json({
      error: {
        code: 'AUTH_INVALID_REFRESH_TOKEN',
        message: 'Invalid or expired refresh token',
        statusCode: 401,
      },
    });
  }
});

// GET /auth/me
router.get('/me', optionalAuth, (req: Request, res: Response) => {
  if (!req.user) {
    res.status(401).json({
      error: {
        code: 'AUTH_NO_TOKEN',
        message: 'Not authenticated',
        statusCode: 401,
      },
    });
    return;
  }

  const db = getDatabase();
  const user = db
    .prepare('SELECT id, username, created_at, last_login FROM users WHERE id = ?')
    .get(req.user.userId) as
    | {
        id: number;
        username: string;
        created_at: string;
        last_login?: string;
      }
    | undefined;

  if (!user) {
    res.status(401).json({
      error: {
        code: 'AUTH_INVALID_TOKEN',
        message: 'User not found',
        statusCode: 401,
      },
    });
    return;
  }

  res.json({
    data: {
      user: {
        id: user.id,
        username: user.username,
        createdAt: user.created_at,
        lastLogin: user.last_login,
      },
    },
  });
});

export default router;

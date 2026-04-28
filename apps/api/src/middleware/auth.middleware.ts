import type { Request, Response, NextFunction } from 'express';
import { authService } from '../services/auth.service.js';
import type { JWTPayload } from '@serverctrl/shared';

declare global {
  namespace Express {
    interface Request {
      user?: JWTPayload;
    }
  }
}

export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  const token = req.cookies.accessToken as string | undefined;

  if (!token) {
    res.status(401).json({
      error: {
        code: 'AUTH_NO_TOKEN',
        message: 'No access token provided',
        statusCode: 401,
      },
    });
    return;
  }

  try {
    const payload = authService.verifyAccessToken(token);
    req.user = payload;
    next();
  } catch {
    res.status(401).json({
      error: {
        code: 'AUTH_INVALID_TOKEN',
        message: 'Invalid or expired access token',
        statusCode: 401,
      },
    });
  }
}

export function optionalAuth(req: Request, _res: Response, next: NextFunction): void {
  const token = req.cookies.accessToken as string | undefined;

  if (token) {
    try {
      req.user = authService.verifyAccessToken(token);
    } catch {
      // Token invalid but optional - continue without user
    }
  }

  next();
}

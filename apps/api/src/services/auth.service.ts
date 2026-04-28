import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { getEnv } from '../config/env.js';
import type { JWTPayload, User } from '@serverctrl/shared';

export class AuthService {
  private readonly jwtSecret: string;
  private readonly jwtRefreshSecret: string;
  private readonly jwtExpiry = '8h';
  private readonly refreshExpiry = '30d';

  constructor() {
    const env = getEnv();
    this.jwtSecret = env.JWT_SECRET;
    this.jwtRefreshSecret = env.JWT_REFRESH_SECRET;
  }

  async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, 12);
  }

  async verifyPassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  createAccessToken(user: User): string {
    const payload: Omit<JWTPayload, 'iat' | 'exp'> = {
      userId: user.id,
      username: user.username,
    };
    return jwt.sign(payload, this.jwtSecret, { expiresIn: this.jwtExpiry });
  }

  createRefreshToken(user: User): string {
    const payload: Omit<JWTPayload, 'iat' | 'exp'> = {
      userId: user.id,
      username: user.username,
    };
    return jwt.sign(payload, this.jwtRefreshSecret, { expiresIn: this.refreshExpiry });
  }

  verifyAccessToken(token: string): JWTPayload {
    return jwt.verify(token, this.jwtSecret) as JWTPayload;
  }

  verifyRefreshToken(token: string): JWTPayload {
    return jwt.verify(token, this.jwtRefreshSecret) as JWTPayload;
  }

  decodeToken(token: string): JWTPayload | null {
    try {
      return jwt.decode(token) as JWTPayload;
    } catch {
      return null;
    }
  }
}

export const authService = new AuthService();

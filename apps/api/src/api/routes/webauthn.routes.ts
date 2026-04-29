/* eslint-disable @typescript-eslint/no-unnecessary-condition */
import { Router, type Router as ExpressRouter } from 'express';
import type { Request, Response } from 'express';
import { webAuthnService } from '../../services/webauthn.service.js';
import { authMiddleware } from '../../middleware/auth.middleware.js';
import { ValidationError } from '../../middleware/errorHandler.js';
import type { RegistrationResponseJSON, AuthenticationResponseJSON } from '@simplewebauthn/types';

interface WebAuthnRequest extends Request {
  user?: {
    userId: number;
    username: string;
  };
}

const router: ExpressRouter = Router();

// All webauthn routes are under /auth/webauthn

// POST /auth/webauthn/register/options - Get registration options (auth required)
router.post('/register/options', authMiddleware, async (req: Request, res: Response, next) => {
  try {
    const webAuthnReq = req as WebAuthnRequest;
    if (!webAuthnReq.user) {
      next(new ValidationError('Authentication required'));
      return;
    }

    const options = await webAuthnService.generateRegistrationOptions({
      id: webAuthnReq.user.userId,
      username: webAuthnReq.user.username,
      createdAt: '',
    });

    res.json({ data: options });
  } catch (error) {
    next(error);
  }
});

// POST /auth/webauthn/register/verify - Verify registration response (auth required)
router.post('/register/verify', authMiddleware, async (req: Request, res: Response, next) => {
  try {
    const webAuthnReq = req as WebAuthnRequest;
    if (!webAuthnReq.user) {
      next(new ValidationError('Authentication required'));
      return;
    }
    const { response: responseJson } = req.body as { response: RegistrationResponseJSON };

    if (!responseJson) {
      next(new ValidationError('Registration response is required'));
      return;
    }

    const result = await webAuthnService.verifyRegistrationResponse(
      webAuthnReq.user.userId,
      responseJson,
    );

    res.status(201).json({
      data: {
        message: 'Passkey registered successfully',
        credentialId: result.credentialId,
      },
    });
  } catch (error) {
    next(error);
  }
});

// POST /auth/webauthn/authentication/options - Get authentication options (no auth required)
router.post('/authentication/options', async (req: Request, res: Response, next) => {
  try {
    const { userId } = req.body as { userId?: number };

    if (!userId) {
      next(new ValidationError('userId is required'));
      return;
    }

    const options = await webAuthnService.generateAuthenticationOptions(userId);

    res.json({ data: options });
  } catch (error) {
    next(error);
  }
});

// POST /auth/webauthn/authentication/verify - Verify authentication response (no auth required)
router.post('/authentication/verify', async (req: Request, res: Response, next) => {
  try {
    const { userId, response: responseJson } = req.body as {
      userId: number;
      response: AuthenticationResponseJSON;
    };

    if (!userId || !responseJson) {
      next(new ValidationError('userId and response are required'));
      return;
    }

    const result = await webAuthnService.verifyAuthenticationResponse(userId, responseJson);

    // Set cookies
    res.cookie('accessToken', result.accessToken, {
      httpOnly: true,
      sameSite: 'strict',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 8 * 60 * 60 * 1000, // 8 hours
    });

    res.cookie('refreshToken', result.refreshToken, {
      httpOnly: true,
      sameSite: 'strict',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    });

    res.json({
      data: {
        user: result.user,
      },
    });
  } catch (error) {
    next(error);
  }
});

// GET /auth/webauthn/passkeys - List user's passkeys (auth required)
router.get('/passkeys', authMiddleware, async (req: Request, res: Response, next) => {
  try {
    const webAuthnReq = req as WebAuthnRequest;
    if (!webAuthnReq.user) {
      next(new ValidationError('Authentication required'));
      return;
    }

    const passkeys = await webAuthnService.listUserPasskeys(webAuthnReq.user.userId);

    res.json({ data: { passkeys } });
  } catch (error) {
    next(error);
  }
});

// DELETE /auth/webauthn/passkeys/:credentialId - Delete a passkey (auth required)
router.delete(
  '/passkeys/:credentialId',
  authMiddleware,
  async (req: Request, res: Response, next) => {
    try {
      const webAuthnReq = req as WebAuthnRequest;
      if (!webAuthnReq.user) {
        next(new ValidationError('Authentication required'));
        return;
      }
      const { credentialId } = req.params;

      if (!credentialId) {
        next(new ValidationError('credentialId is required'));
        return;
      }

      await webAuthnService.deletePasskey(webAuthnReq.user.userId, credentialId);

      res.json({ data: { message: 'Passkey deleted successfully' } });
    } catch (error) {
      next(error);
    }
  },
);

export default router;

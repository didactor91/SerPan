import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from '@simplewebauthn/server';
/* eslint-disable @typescript-eslint/no-unnecessary-condition */
import type {
  AuthenticationResponseJSON,
  RegistrationResponseJSON,
  AuthenticatorDevice,
} from '@simplewebauthn/types';
import { getEnv } from '../config/env.js';
import { getDatabase } from '../db/schema.js';
import { authService } from './auth.service.js';
import { ForbiddenError, NotFoundError, ValidationError } from '../middleware/errorHandler.js';
import type { User } from '@serverctrl/shared';

interface ChallengeEntry {
  userId: number;
  expiresAt: number;
}

// Challenge store: Map<challenge, { userId, expiresAt }>
// TTL: 5 minutes = 300000ms
const CHALLENGE_TTL_MS = 5 * 60 * 1000;
const challengeStore = new Map<string, ChallengeEntry>();

// Cleanup expired challenges periodically
function cleanupExpiredChallenges(): void {
  const now = Date.now();
  for (const [challenge, entry] of challengeStore.entries()) {
    if (now > entry.expiresAt) {
      challengeStore.delete(challenge);
    }
  }
}

// Cleanup on interval
setInterval(cleanupExpiredChallenges, CHALLENGE_TTL_MS);

function storeChallenge(challenge: string, userId: number): void {
  cleanupExpiredChallenges();
  challengeStore.set(challenge, {
    userId,
    expiresAt: Date.now() + CHALLENGE_TTL_MS,
  });
}

function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function base64URLStringToUint8Array(base64URL: string): Uint8Array {
  // Convert base64url to base64 (standard base64)
  const base64 = base64URL.replace(/-/g, '+').replace(/_/g, '/');
  // Pad with '=' if necessary
  const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=');
  // Decode using the Web API
  const binaryString = atob(padded);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

function uint8ArrayToBase64URL(array: Uint8Array): string {
  const base64 = btoa(String.fromCharCode(...array));
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

export class WebAuthnService {
  async generateRegistrationOptions(user: User): Promise<{
    timeout: number;
    challenge: string;
    rp: { name: string; id: string };
    user: { name: string; displayName: string; id: string };
    pubKeyCredParams: { type: 'public-key'; alg: number }[];
    excludeCredentials?: { id: string; type: 'public-key' }[];
    authenticatorSelection?: {
      authenticatorAttachment?: 'platform' | 'cross-platform';
      residentKey?: 'preferred' | 'required' | 'discouraged';
      requireResidentKey?: boolean;
      userVerification?: 'preferred' | 'required' | 'discouraged';
    };
    attestation?: 'none' | 'indirect' | 'direct';
    extensions?: Record<string, unknown>;
  }> {
    const env = getEnv();
    const db = getDatabase();

    // Generate or get webauthn_user_id for this user
    const webauthnUserIdRow = db
      .prepare('SELECT webauthn_user_id FROM users WHERE id = ?')
      .get(user.id) as { webauthn_user_id: string | null } | undefined;

    let webauthnUserIdValue: string;
    if (!webauthnUserIdRow?.webauthn_user_id) {
      webauthnUserIdValue = generateUUID();
      db.prepare('UPDATE users SET webauthn_user_id = ? WHERE id = ?').run(
        webauthnUserIdValue,
        user.id,
      );
    } else {
      webauthnUserIdValue = webauthnUserIdRow.webauthn_user_id;
    }

    // Get existing credentials to exclude (prevent duplicate)
    const existingPasskeys = db
      .prepare('SELECT credential_id FROM user_passkeys WHERE user_id = ?')
      .all(user.id) as { credential_id: string }[];

    const excludeCredentials = existingPasskeys.map((pk) => ({
      id: base64URLStringToUint8Array(pk.credential_id),
      type: 'public-key' as const,
    }));

    const challenge = generateUUID();
    const challengeBase64URL = uint8ArrayToBase64URL(new TextEncoder().encode(challenge));

    const options = await generateRegistrationOptions({
      rpName: env.WEBAUTHN_RP_NAME,
      rpID: env.WEBAUTHN_RP_ID,
      userID: webauthnUserIdValue,
      userName: user.username,
      userDisplayName: user.username,
      challenge: challengeBase64URL,
      excludeCredentials: existingPasskeys.length > 0 ? excludeCredentials : [],
      attestationType: 'none',
    });

    // Store challenge with user ID
    storeChallenge(options.challenge, user.id);

    return options as {
      timeout: number;
      challenge: string;
      rp: { name: string; id: string };
      user: { name: string; displayName: string; id: string };
      pubKeyCredParams: { type: 'public-key'; alg: number }[];
      excludeCredentials?: { id: string; type: 'public-key' }[];
      authenticatorSelection?: {
        authenticatorAttachment?: 'platform' | 'cross-platform';
        residentKey?: 'preferred' | 'required' | 'discouraged';
        requireResidentKey?: boolean;
        userVerification?: 'preferred' | 'required' | 'discouraged';
      };
      attestation?: 'none' | 'indirect' | 'direct';
      extensions?: Record<string, unknown>;
    };
  }

  async verifyRegistrationResponse(
    userId: number,
    response: RegistrationResponseJSON,
  ): Promise<{ credentialId: string; publicKey: string; counter: number; deviceType?: string }> {
    const env = getEnv();
    const db = getDatabase();

    if (!response.response.attestationObject) {
      throw new ValidationError('Missing attestation object');
    }

    // Find the challenge for this user
    const userChallenges = Array.from(challengeStore.entries())
      .filter(([, entry]) => entry.userId === userId)
      .map(([challenge, entry]) => ({ challenge, ...entry }));

    if (userChallenges.length === 0) {
      throw new ValidationError(
        'No pending challenge found. Please request new registration options.',
      );
    }

    // Use the most recent challenge for this user
    const sortedChallenges = userChallenges.sort((a, b) => b.expiresAt - a.expiresAt);
    const latestChallenge = sortedChallenges.at(0)?.challenge;
    if (!latestChallenge) {
      throw new ValidationError('No pending challenge found');
    }

    // Remove the challenge after use
    challengeStore.delete(latestChallenge);

    const { verified, registrationInfo } = await verifyRegistrationResponse({
      response,
      expectedChallenge: latestChallenge,
      expectedOrigin: `https://${env.WEBAUTHN_RP_ID}`,
      expectedRPID: env.WEBAUTHN_RP_ID,
      requireUserVerification: false,
    });

    if (!verified || !registrationInfo) {
      throw new ValidationError('Registration verification failed');
    }

    // Verify counter is 0 (new credential)
    if (registrationInfo.counter !== 0) {
      throw new ValidationError('Expected new credential counter to be 0');
    }

    // Convert credentialID and publicKey to base64url strings for storage
    const credentialId = uint8ArrayToBase64URL(registrationInfo.credentialID);
    const publicKey = uint8ArrayToBase64URL(registrationInfo.credentialPublicKey);

    // Check if credential already exists
    const existing = db
      .prepare('SELECT id FROM user_passkeys WHERE credential_id = ?')
      .get(credentialId);

    if (existing) {
      throw new ValidationError('Credential already registered');
    }

    // Get webauthn_user_id for the user
    const webauthnUserIdRow = db
      .prepare('SELECT webauthn_user_id FROM users WHERE id = ?')
      .get(userId) as { webauthn_user_id: string | null } | undefined;

    if (!webauthnUserIdRow?.webauthn_user_id) {
      const newUserId = generateUUID();
      db.prepare('UPDATE users SET webauthn_user_id = ? WHERE id = ?').run(newUserId, userId);
    }

    db.prepare(
      `INSERT INTO user_passkeys (user_id, credential_id, public_key, counter, device_type, device_name)
       VALUES (?, ?, ?, ?, ?, ?)`,
    ).run(
      userId,
      credentialId,
      publicKey,
      registrationInfo.counter,
      registrationInfo.credentialDeviceType,
      null,
    );

    return {
      credentialId,
      publicKey,
      counter: registrationInfo.counter,
      deviceType: registrationInfo.credentialDeviceType,
    };
  }

  async generateAuthenticationOptions(userId: number): Promise<{
    timeout?: number;
    challenge: string;
    rpId: string;
    allowCredentials?: { id: string; type: 'public-key' }[];
    userVerification?: 'preferred' | 'required' | 'discouraged';
    extensions?: Record<string, unknown>;
  }> {
    const env = getEnv();
    const db = getDatabase();

    // Get user's passkeys
    const passkeys = db
      .prepare('SELECT credential_id FROM user_passkeys WHERE user_id = ?')
      .all(userId) as { credential_id: string }[];

    if (passkeys.length === 0) {
      throw new ValidationError('No passkeys registered for this user');
    }

    const allowCredentials = passkeys.map((pk) => ({
      id: base64URLStringToUint8Array(pk.credential_id),
      type: 'public-key' as const,
    }));

    const challenge = generateUUID();
    const challengeBase64URL = uint8ArrayToBase64URL(new TextEncoder().encode(challenge));

    const options = await generateAuthenticationOptions({
      timeout: 60000,
      rpID: env.WEBAUTHN_RP_ID,
      challenge: challengeBase64URL,
      allowCredentials,
      userVerification: 'preferred',
    });

    // Store challenge with user ID
    storeChallenge(options.challenge, userId);

    return options as {
      timeout?: number;
      challenge: string;
      rpId: string;
      allowCredentials?: { id: string; type: 'public-key' }[];
      userVerification?: 'preferred' | 'required' | 'discouraged';
      extensions?: Record<string, unknown>;
    };
  }

  async verifyAuthenticationResponse(
    userId: number,
    response: AuthenticationResponseJSON,
  ): Promise<{ user: User; accessToken: string; refreshToken: string }> {
    const env = getEnv();
    const db = getDatabase();

    // Get passkey from database
    const passkey = db
      .prepare('SELECT * FROM user_passkeys WHERE credential_id = ? AND user_id = ?')
      .get(response.id, userId) as
      | {
          id: number;
          credential_id: string;
          public_key: string;
          counter: number;
          device_type: string | null;
          device_name: string | null;
        }
      | undefined;

    if (!passkey) {
      throw new NotFoundError('Passkey');
    }

    const latestChallenge = this.findChallengeForUser(userId);
    challengeStore.delete(latestChallenge);

    const authenticator = this.buildAuthenticatorDevice(passkey);
    const authenticationInfo = await this.verifyAuthentication(
      env,
      response,
      latestChallenge,
      authenticator,
    );
    this.validateCounter(authenticationInfo, passkey.counter);

    // Update counter in database
    db.prepare('UPDATE user_passkeys SET counter = ? WHERE credential_id = ?').run(
      authenticationInfo.newCounter,
      response.id,
    );

    const user = this.getUserForToken(db, userId);
    const accessToken = authService.createAccessToken(user);
    const refreshToken = authService.createRefreshToken(user);

    return { user, accessToken, refreshToken };
  }

  private findChallengeForUser(userId: number): string {
    const userChallenges = Array.from(challengeStore.entries())
      .filter(([, entry]) => entry.userId === userId)
      .map(([challenge, entry]) => ({ challenge, ...entry }));

    if (userChallenges.length === 0) {
      throw new ValidationError(
        'No pending challenge found. Please request new authentication options.',
      );
    }

    const sortedChallenges = userChallenges.sort((a, b) => b.expiresAt - a.expiresAt);
    const latestChallenge = sortedChallenges.at(0)?.challenge;
    if (!latestChallenge) {
      throw new ValidationError('No pending challenge found');
    }
    return latestChallenge;
  }

  private buildAuthenticatorDevice(passkey: {
    credential_id: string;
    public_key: string;
    counter: number;
  }): AuthenticatorDevice {
    return {
      credentialPublicKey: base64URLStringToUint8Array(passkey.public_key),
      credentialID: base64URLStringToUint8Array(passkey.credential_id),
      counter: passkey.counter,
    };
  }

  private async verifyAuthentication(
    env: ReturnType<typeof getEnv>,
    response: AuthenticationResponseJSON,
    latestChallenge: string,
    authenticator: AuthenticatorDevice,
  ): Promise<{ newCounter: number }> {
    const { verified, authenticationInfo } = await verifyAuthenticationResponse({
      response,
      expectedChallenge: latestChallenge,
      expectedOrigin: `https://${env.WEBAUTHN_RP_ID}`,
      expectedRPID: env.WEBAUTHN_RP_ID,
      authenticator,
      requireUserVerification: false,
    });

    if (!verified || !authenticationInfo) {
      throw new ValidationError('Authentication verification failed');
    }
    return authenticationInfo;
  }

  private validateCounter(authenticationInfo: { newCounter: number }, storedCounter: number): void {
    if (authenticationInfo.newCounter <= storedCounter) {
      throw new ValidationError(
        'WEBAUTHN_COUNTER_REGRESSION: Authenticator counter is the same or lower than registered',
      );
    }
  }

  private getUserForToken(db: ReturnType<typeof getDatabase>, userId: number): User {
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId) as
      | {
          id: number;
          username: string;
          webauthn_user_id: string | null;
          created_at: string;
          last_login: string | null;
        }
      | undefined;

    if (!user) {
      throw new NotFoundError('User');
    }

    return {
      id: user.id,
      username: user.username,
      createdAt: user.created_at,
    };
  }

  async listUserPasskeys(userId: number): Promise<PasskeyInfo[]> {
    const db = getDatabase();

    const passkeys = db
      .prepare(
        `SELECT id, credential_id, device_type, device_name, created_at
         FROM user_passkeys WHERE user_id = ? ORDER BY created_at DESC`,
      )
      .all(userId) as {
      id: number;
      credential_id: string;
      device_type: string | null;
      device_name: string | null;
      created_at: string;
    }[];

    return passkeys.map((pk) => ({
      id: pk.id,
      credentialId: maskCredentialId(pk.credential_id),
      deviceType: pk.device_type,
      deviceName: pk.device_name,
      createdAt: pk.created_at,
    }));
  }

  async deletePasskey(userId: number, credentialId: string): Promise<void> {
    const db = getDatabase();

    // First check if the passkey exists and belongs to this user
    const passkey = db
      .prepare('SELECT user_id FROM user_passkeys WHERE credential_id = ?')
      .get(credentialId) as { user_id: number } | undefined;

    if (!passkey) {
      throw new NotFoundError('Passkey');
    }

    if (passkey.user_id !== userId) {
      throw new ForbiddenError("Cannot delete another user's passkey");
    }

    db.prepare('DELETE FROM user_passkeys WHERE credential_id = ?').run(credentialId);
  }
}

interface PasskeyInfo {
  id: number;
  credentialId: string;
  deviceType: string | null;
  deviceName: string | null;
  createdAt: string;
}

function maskCredentialId(credentialId: string): string {
  if (credentialId.length <= 12) {
    return credentialId.substring(0, 4) + '****' + credentialId.substring(credentialId.length - 4);
  }
  return credentialId.substring(0, 8) + '****' + credentialId.substring(credentialId.length - 4);
}

export const webAuthnService = new WebAuthnService();

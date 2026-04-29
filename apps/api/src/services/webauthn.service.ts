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
import { eq } from 'drizzle-orm';
import { getEnv } from '../config/env.js';
import { getDatabase, users, userPasskeys } from '../db/schema.js';
import { authService } from './auth.service.js';
import { ForbiddenError, NotFoundError, ValidationError } from '../middleware/errorHandler.js';
import type { User, PasskeyInfo } from '@serverctrl/shared';

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
      .select({ webauthnUserId: users.webauthnUserId })
      .from(users)
      .where(eq(users.id, user.id))
      .get();

    let webauthnUserIdValue: string;
    if (!webauthnUserIdRow?.webauthnUserId) {
      webauthnUserIdValue = generateUUID();
      db.update(users)
        .set({ webauthnUserId: webauthnUserIdValue })
        .where(eq(users.id, user.id))
        .run();
    } else {
      webauthnUserIdValue = webauthnUserIdRow.webauthnUserId;
    }

    // Get existing credentials to exclude (prevent duplicate)
    const existingPasskeys = db
      .select({ credentialId: userPasskeys.credentialId })
      .from(userPasskeys)
      .where(eq(userPasskeys.userId, user.id))
      .all();

    const excludeCredentials = existingPasskeys.map((pk) => ({
      id: base64URLStringToUint8Array(pk.credentialId),
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
      .select({ id: userPasskeys.id })
      .from(userPasskeys)
      .where(eq(userPasskeys.credentialId, credentialId))
      .get();

    if (existing) {
      throw new ValidationError('Credential already registered');
    }

    // Get webauthn_user_id for the user
    const webauthnUserIdRow = db
      .select({ webauthnUserId: users.webauthnUserId })
      .from(users)
      .where(eq(users.id, userId))
      .get();

    if (!webauthnUserIdRow?.webauthnUserId) {
      const newUserId = generateUUID();
      db.update(users).set({ webauthnUserId: newUserId }).where(eq(users.id, userId)).run();
    }

    db.insert(userPasskeys)
      .values({
        userId,
        credentialId,
        publicKey,
        counter: registrationInfo.counter,
        deviceType: registrationInfo.credentialDeviceType,
        deviceName: null,
      })
      .run();

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
      .select({ credentialId: userPasskeys.credentialId })
      .from(userPasskeys)
      .where(eq(userPasskeys.userId, userId))
      .all();

    if (passkeys.length === 0) {
      throw new ValidationError('No passkeys registered for this user');
    }

    const allowCredentials = passkeys.map((pk) => ({
      id: base64URLStringToUint8Array(pk.credentialId),
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
      .select()
      .from(userPasskeys)
      .where(eq(userPasskeys.credentialId, response.id))
      .get();

    if (!passkey || passkey?.userId !== userId) {
      throw new NotFoundError('Passkey');
    }

    const latestChallenge = this.findChallengeForUser(userId);
    challengeStore.delete(latestChallenge);

    const authenticator = this.buildAuthenticatorDevice({
      credentialId: passkey.credentialId,
      publicKey: passkey.publicKey,
      counter: passkey.counter,
    });
    const authenticationInfo = await this.verifyAuthentication(
      env,
      response,
      latestChallenge,
      authenticator,
    );
    this.validateCounter(authenticationInfo, passkey.counter);

    // Update counter in database
    db.update(userPasskeys)
      .set({ counter: authenticationInfo.newCounter })
      .where(eq(userPasskeys.credentialId, response.id))
      .run();

    const user = this.getUserForToken(userId);
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
    credentialId: string;
    publicKey: string;
    counter: number;
  }): AuthenticatorDevice {
    return {
      credentialPublicKey: base64URLStringToUint8Array(passkey.publicKey),
      credentialID: base64URLStringToUint8Array(passkey.credentialId),
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

  private getUserForToken(userId: number): User {
    const db = getDatabase();
    const user = db.select().from(users).where(eq(users.id, userId)).get();

    if (!user) {
      throw new NotFoundError('User');
    }

    return {
      id: user.id,
      username: user.username,
      createdAt: user.createdAt,
    };
  }

  async listUserPasskeys(userId: number): Promise<PasskeyInfo[]> {
    const db = getDatabase();

    const passkeys = db
      .select({
        id: userPasskeys.id,
        credentialId: userPasskeys.credentialId,
        deviceType: userPasskeys.deviceType,
        deviceName: userPasskeys.deviceName,
        createdAt: userPasskeys.createdAt,
      })
      .from(userPasskeys)
      .where(eq(userPasskeys.userId, userId))
      .all();

    return passkeys
      .map((pk) => ({
        id: pk.id,
        credentialId: maskCredentialId(pk.credentialId),
        deviceType: pk.deviceType,
        deviceName: pk.deviceName,
        createdAt: pk.createdAt,
      }))
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async deletePasskey(userId: number, credentialId: string): Promise<void> {
    const db = getDatabase();

    // First check if the passkey exists and belongs to this user
    const passkey = db
      .select({ userId: userPasskeys.userId })
      .from(userPasskeys)
      .where(eq(userPasskeys.credentialId, credentialId))
      .get();

    if (!passkey) {
      throw new NotFoundError('Passkey');
    }

    if (passkey.userId !== userId) {
      throw new ForbiddenError("Cannot delete another user's passkey");
    }

    db.delete(userPasskeys).where(eq(userPasskeys.credentialId, credentialId)).run();
  }
}

function maskCredentialId(credentialId: string): string {
  if (credentialId.length <= 12) {
    return credentialId.substring(0, 4) + '****' + credentialId.substring(credentialId.length - 4);
  }
  return credentialId.substring(0, 8) + '****' + credentialId.substring(credentialId.length - 4);
}

export const webAuthnService = new WebAuthnService();

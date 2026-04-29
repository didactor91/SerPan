import { apiClient } from '../api/client';
import type { RegistrationResponseJSON, AuthenticationResponseJSON } from '@simplewebauthn/types';
import type { PasskeyInfo } from '@serverctrl/shared';

export interface RegistrationOptionsResponse {
  timeout: number;
  challenge: string;
  rp: {
    name: string;
    id: string;
  };
  user: {
    name: string;
    displayName: string;
    id: string;
  };
  pubKeyCredParams: Array<{ type: 'public-key'; alg: number }>;
  excludeCredentials?: Array<{ id: string; type: 'public-key' }>;
  authenticatorSelection?: {
    authenticatorAttachment?: 'platform' | 'cross-platform';
    residentKey?: 'preferred' | 'required' | 'discouraged';
    requireResidentKey?: boolean;
    userVerification?: 'preferred' | 'required' | 'discouraged';
  };
  attestation?: 'none' | 'indirect' | 'direct';
  extensions?: Record<string, unknown>;
}

export interface AuthenticationOptionsResponse {
  timeout?: number;
  challenge: string;
  rpId: string;
  allowCredentials?: Array<{ id: string; type: 'public-key' }>;
  userVerification?: 'preferred' | 'required' | 'discouraged';
  extensions?: Record<string, unknown>;
}

export async function registerOptions(): Promise<RegistrationOptionsResponse> {
  return apiClient.post<RegistrationOptionsResponse>('/auth/webauthn/register/options', {});
}

export async function registerVerify(
  response: RegistrationResponseJSON,
): Promise<{ credentialId: string }> {
  return apiClient.post<{ credentialId: string }>('/auth/webauthn/register/verify', { response });
}

export async function authenticationOptions(
  userId: number,
): Promise<AuthenticationOptionsResponse> {
  return apiClient.post<AuthenticationOptionsResponse>('/auth/webauthn/authentication/options', {
    userId,
  });
}

export async function authenticationVerify(
  userId: number,
  response: AuthenticationResponseJSON,
): Promise<{ user: { id: number; username: string } }> {
  return apiClient.post<{ user: { id: number; username: string } }>(
    '/auth/webauthn/authentication/verify',
    {
      userId,
      response,
    },
  );
}

export async function listPasskeys(): Promise<{ passkeys: PasskeyInfo[] }> {
  return apiClient.get<{ passkeys: PasskeyInfo[] }>('/auth/webauthn/passkeys');
}

export async function deletePasskey(credentialId: string): Promise<void> {
  await apiClient.delete(`/auth/webauthn/passkeys/${encodeURIComponent(credentialId)}`);
}

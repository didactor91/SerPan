import { useState, useEffect, useCallback } from 'react';
import { useNotificationsStore } from '@/stores/notifications.store';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import {
  listPasskeys,
  deletePasskey,
  registerOptions,
  registerVerify,
} from '@/services/webauthn.service';
import type { PasskeyInfo } from '@serverctrl/shared';
import { base64URLStringToBuffer } from '@simplewebauthn/browser';
import type { AuthenticatorSelectionCriteria } from '@simplewebauthn/types';

function uint8ArrayToBase64URL(array: Uint8Array): string {
  const binary = String.fromCharCode(...array);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

// eslint-disable-next-line max-lines-per-function
export function SettingsPage() {
  const [passkeys, setPasskeys] = useState<PasskeyInfo[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const { add } = useNotificationsStore();

  const loadPasskeys = useCallback(async () => {
    setIsLoading(true);
    try {
      const result = await listPasskeys();
      setPasskeys(result.passkeys);
    } catch (error) {
      add({
        type: 'error',
        message: error instanceof Error ? error.message : 'Failed to load passkeys',
      });
    } finally {
      setIsLoading(false);
    }
  }, [add]);

  useEffect(() => {
    void loadPasskeys();
  }, [loadPasskeys]);

  const handleRegisterPasskey = async () => {
    setIsRegistering(true);
    try {
      // Get registration options
      const options = await registerOptions();

      // Convert options to the format expected by simplewebauthn browser
      const publicKeyOptions: PublicKeyCredentialCreationOptions = {
        timeout: options.timeout,
        challenge: base64URLStringToBuffer(options.challenge),
        rp: options.rp,
        user: {
          name: options.user.name,
          displayName: options.user.displayName,
          id: base64URLStringToBuffer(options.user.id),
        },
        pubKeyCredParams: options.pubKeyCredParams,
        excludeCredentials:
          options.excludeCredentials?.map((cred) => ({
            id: base64URLStringToBuffer(cred.id),
            type: cred.type,
          })) ?? [],
        attestation: options.attestation ?? 'none',
      };

      if (options.authenticatorSelection) {
        publicKeyOptions.authenticatorSelection =
          options.authenticatorSelection as AuthenticatorSelectionCriteria;
      }

      const credential = await navigator.credentials.create({ publicKey: publicKeyOptions });

      if (!credential) {
        throw new Error('No credential returned');
      }

      const credentialResponse = credential as PublicKeyCredential;

      // Convert to registration response JSON
      const responseJson = {
        id: credentialResponse.id,
        rawId: uint8ArrayToBase64URL(new Uint8Array(credentialResponse.rawId)),
        type: credentialResponse.type as 'public-key',
        response: {
          clientDataJSON: uint8ArrayToBase64URL(
            new Uint8Array(
              (credentialResponse.response as AuthenticatorAttestationResponse).clientDataJSON,
            ),
          ),
          attestationObject: uint8ArrayToBase64URL(
            new Uint8Array(
              (credentialResponse.response as AuthenticatorAttestationResponse).attestationObject,
            ),
          ),
        },
        clientExtensionResults: {},
      };

      // Verify the registration
      await registerVerify(responseJson);

      add({ type: 'success', message: 'Passkey registered successfully' });
      await loadPasskeys();
    } catch (error) {
      add({
        type: 'error',
        message: error instanceof Error ? error.message : 'Failed to register passkey',
      });
    } finally {
      setIsRegistering(false);
    }
  };

  const handleDeletePasskey = async (credentialId: string) => {
    if (!confirm('Are you sure you want to delete this passkey?')) {
      return;
    }

    try {
      await deletePasskey(credentialId);
      add({ type: 'success', message: 'Passkey deleted successfully' });
      await loadPasskeys();
    } catch (error) {
      add({
        type: 'error',
        message: error instanceof Error ? error.message : 'Failed to delete passkey',
      });
    }
  };

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">Settings</h1>

      {/* Passkey Management Section */}
      <Card>
        <CardHeader>
          <CardTitle>Passkeys</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Passkeys allow you to log in without a password using WebAuthn (FIDO2).
          </p>

          {/* Passkey List */}
          {isLoading ? (
            <p className="text-sm">Loading passkeys...</p>
          ) : passkeys.length === 0 ? (
            <p className="text-sm text-muted-foreground">No passkeys registered yet.</p>
          ) : (
            <div className="space-y-2">
              {passkeys.map((passkey) => (
                <div
                  key={passkey.id}
                  className="flex items-center justify-between p-3 border rounded-lg"
                >
                  <div>
                    <p className="font-mono text-sm">{passkey.credentialId}</p>
                    <p className="text-xs text-muted-foreground">
                      {passkey.deviceType ?? 'Unknown device'} • Added{' '}
                      {new Date(passkey.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => void handleDeletePasskey(passkey.credentialId)}
                  >
                    Delete
                  </Button>
                </div>
              ))}
            </div>
          )}

          {/* Register New Passkey */}
          <div className="pt-4 border-t">
            <Button onClick={() => void handleRegisterPasskey()} disabled={isRegistering}>
              {isRegistering ? 'Registering...' : 'Add Passkey'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

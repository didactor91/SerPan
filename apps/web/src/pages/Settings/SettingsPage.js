import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect } from 'react';
import { useNotificationsStore } from '@/stores/notifications.store';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { listPasskeys, deletePasskey, registerOptions, registerVerify, } from '@/services/webauthn.service';
import { base64URLStringToBuffer } from '@simplewebauthn/browser';
function uint8ArrayToBase64URL(array) {
    const binary = String.fromCharCode(...array);
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}
export function SettingsPage() {
    const [passkeys, setPasskeys] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isRegistering, setIsRegistering] = useState(false);
    const { add } = useNotificationsStore();
    const loadPasskeys = async () => {
        setIsLoading(true);
        try {
            const result = await listPasskeys();
            setPasskeys(result.passkeys);
        }
        catch (error) {
            add({
                type: 'error',
                message: error instanceof Error ? error.message : 'Failed to load passkeys',
            });
        }
        finally {
            setIsLoading(false);
        }
    };
    useEffect(() => {
        void loadPasskeys();
    }, []);
    const handleRegisterPasskey = async () => {
        setIsRegistering(true);
        try {
            // Get registration options
            const options = await registerOptions();
            // Convert options to the format expected by simplewebauthn browser
            const publicKeyOptions = {
                timeout: options.timeout ?? 60000,
                challenge: base64URLStringToBuffer(options.challenge),
                rp: options.rp,
                user: {
                    name: options.user.name,
                    displayName: options.user.displayName,
                    id: base64URLStringToBuffer(options.user.id),
                },
                pubKeyCredParams: options.pubKeyCredParams,
                excludeCredentials: options.excludeCredentials?.map((cred) => ({
                    id: base64URLStringToBuffer(cred.id),
                    type: cred.type,
                })) || [],
                attestation: options.attestation || 'none',
            };
            if (options.authenticatorSelection) {
                publicKeyOptions.authenticatorSelection =
                    options.authenticatorSelection;
            }
            const credential = await navigator.credentials.create({ publicKey: publicKeyOptions });
            if (!credential) {
                throw new Error('No credential returned');
            }
            const credentialResponse = credential;
            // Convert to registration response JSON
            const responseJson = {
                id: credentialResponse.id,
                rawId: uint8ArrayToBase64URL(new Uint8Array(credentialResponse.rawId)),
                type: credentialResponse.type,
                response: {
                    clientDataJSON: uint8ArrayToBase64URL(new Uint8Array(credentialResponse.response.clientDataJSON)),
                    attestationObject: uint8ArrayToBase64URL(new Uint8Array(credentialResponse.response.attestationObject)),
                },
                clientExtensionResults: {},
            };
            // Verify the registration
            await registerVerify(responseJson);
            add({ type: 'success', message: 'Passkey registered successfully' });
            await loadPasskeys();
        }
        catch (error) {
            add({
                type: 'error',
                message: error instanceof Error ? error.message : 'Failed to register passkey',
            });
        }
        finally {
            setIsRegistering(false);
        }
    };
    const handleDeletePasskey = async (credentialId) => {
        if (!confirm('Are you sure you want to delete this passkey?')) {
            return;
        }
        try {
            await deletePasskey(credentialId);
            add({ type: 'success', message: 'Passkey deleted successfully' });
            await loadPasskeys();
        }
        catch (error) {
            add({
                type: 'error',
                message: error instanceof Error ? error.message : 'Failed to delete passkey',
            });
        }
    };
    return (_jsxs("div", { className: "p-6 space-y-6", children: [_jsx("h1", { className: "text-2xl font-bold", children: "Settings" }), _jsxs(Card, { children: [_jsx(CardHeader, { children: _jsx(CardTitle, { children: "Passkeys" }) }), _jsxs(CardContent, { className: "space-y-4", children: [_jsx("p", { className: "text-sm text-muted-foreground", children: "Passkeys allow you to log in without a password using WebAuthn (FIDO2)." }), isLoading ? (_jsx("p", { className: "text-sm", children: "Loading passkeys..." })) : passkeys.length === 0 ? (_jsx("p", { className: "text-sm text-muted-foreground", children: "No passkeys registered yet." })) : (_jsx("div", { className: "space-y-2", children: passkeys.map((passkey) => (_jsxs("div", { className: "flex items-center justify-between p-3 border rounded-lg", children: [_jsxs("div", { children: [_jsx("p", { className: "font-mono text-sm", children: passkey.credentialId }), _jsxs("p", { className: "text-xs text-muted-foreground", children: [passkey.deviceType || 'Unknown device', " \u2022 Added", ' ', new Date(passkey.createdAt).toLocaleDateString()] })] }), _jsx(Button, { variant: "destructive", size: "sm", onClick: () => handleDeletePasskey(passkey.credentialId), children: "Delete" })] }, passkey.id))) })), _jsx("div", { className: "pt-4 border-t", children: _jsx(Button, { onClick: () => void handleRegisterPasskey(), disabled: isRegistering, children: isRegistering ? 'Registering...' : 'Add Passkey' }) })] })] })] }));
}

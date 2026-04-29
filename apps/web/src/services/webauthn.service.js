import { apiClient } from '../api/client';
export async function registerOptions() {
    return apiClient.post('/auth/webauthn/register/options', {});
}
export async function registerVerify(response) {
    return apiClient.post('/auth/webauthn/register/verify', { response });
}
export async function authenticationOptions(userId) {
    return apiClient.post('/auth/webauthn/authentication/options', {
        userId,
    });
}
export async function authenticationVerify(userId, response) {
    return apiClient.post('/auth/webauthn/authentication/verify', {
        userId,
        response,
    });
}
export async function listPasskeys() {
    return apiClient.get('/auth/webauthn/passkeys');
}
export async function deletePasskey(credentialId) {
    await apiClient.delete(`/auth/webauthn/passkeys/${encodeURIComponent(credentialId)}`);
}

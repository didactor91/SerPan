import { jsx as _jsx, jsxs as _jsxs } from 'react/jsx-runtime';
import { useState, useCallback } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useAuthStore } from '@/stores/auth.store';
import { useNotificationsStore } from '@/stores/notifications.store';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
async function checkWebAuthnSupport() {
  if (typeof window.PublicKeyCredential === 'undefined') {
    return { supported: false, available: false };
  }
  const available = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  return { supported: true, available };
}
// eslint-disable-next-line max-lines-per-function
export function LoginPage({ webAuthnSupported = true }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { login } = useAuthStore();
  const { add } = useNotificationsStore();
  const navigate = useNavigate();
  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      await login(username, password);
      add({ type: 'success', message: 'Logged in successfully' });
      await navigate({ to: '/dashboard' });
    } catch (error) {
      add({ type: 'error', message: error instanceof Error ? error.message : 'Login failed' });
    } finally {
      setIsLoading(false);
    }
  };
  const handlePasskeyLogin = useCallback(async () => {
    if (!username.trim()) {
      add({ type: 'error', message: 'Please enter your username first' });
      return;
    }
    setIsLoading(true);
    try {
      const { supported, available } = await checkWebAuthnSupport();
      if (!supported) {
        add({ type: 'error', message: 'WebAuthn is not supported in this browser' });
        return;
      }
      if (!available) {
        add({ type: 'error', message: 'Passkey login is not available on this device' });
        return;
      }
      add({
        type: 'info',
        message: 'Passkey login requires a registered passkey. Please use password login first.',
      });
    } catch (error) {
      add({
        type: 'error',
        message: error instanceof Error ? error.message : 'Passkey login failed',
      });
    } finally {
      setIsLoading(false);
    }
  }, [username, add, setIsLoading]);
  return _jsx('div', {
    className: 'flex h-screen items-center justify-center bg-background',
    children: _jsxs(Card, {
      className: 'w-[350px]',
      children: [
        _jsx(CardHeader, { children: _jsx(CardTitle, { children: 'ServerCtrl Login' }) }),
        _jsx(CardContent, {
          children: _jsxs('form', {
            onSubmit: (e) => {
              e.preventDefault();
              void handleSubmit(e);
            },
            className: 'space-y-4',
            children: [
              _jsxs('div', {
                children: [
                  _jsx(Label, { htmlFor: 'username', required: true, children: 'Username' }),
                  _jsx(Input, {
                    id: 'username',
                    value: username,
                    onChange: (e) => setUsername(e.target.value),
                    autoComplete: 'username',
                    required: true,
                  }),
                ],
              }),
              _jsxs('div', {
                children: [
                  _jsx(Label, { htmlFor: 'password', required: true, children: 'Password' }),
                  _jsx(Input, {
                    id: 'password',
                    type: 'password',
                    value: password,
                    onChange: (e) => setPassword(e.target.value),
                    autoComplete: 'current-password',
                    required: true,
                  }),
                ],
              }),
              _jsx(Button, {
                type: 'submit',
                className: 'w-full',
                disabled: isLoading,
                children: isLoading ? 'Logging in...' : 'Login with Password',
              }),
              webAuthnSupported &&
                _jsx(Button, {
                  type: 'button',
                  variant: 'secondary',
                  className: 'w-full',
                  onClick: () => void handlePasskeyLogin(),
                  disabled: isLoading,
                  children: isLoading ? 'Please wait...' : 'Use Passkey',
                }),
            ],
          }),
        }),
      ],
    }),
  });
}

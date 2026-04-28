import { create } from 'zustand';
import type { User } from '@serverctrl/shared';

interface AuthResponse {
  data: {
    user: User;
  };
}

interface ErrorResponse {
  error?: {
    message?: string;
  };
}

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<boolean>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,
  isLoading: true,

  login: async (username: string, password: string) => {
    const res = await fetch('/api/v1/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ username, password }),
    });

    if (!res.ok) {
      const error: ErrorResponse = (await res.json()) as ErrorResponse;
      throw new Error(error.error?.message ?? 'Login failed');
    }

    const data: AuthResponse = (await res.json()) as AuthResponse;
    set({ user: data.data.user, isAuthenticated: true, isLoading: false });
  },

  logout: async () => {
    await fetch('/api/v1/auth/logout', {
      method: 'POST',
      credentials: 'include',
    });
    set({ user: null, isAuthenticated: false, isLoading: false });
  },

  checkAuth: async (): Promise<boolean> => {
    set({ isLoading: true });

    try {
      const res = await fetch('/api/v1/auth/me', {
        credentials: 'include',
      });

      if (!res.ok) {
        set({ user: null, isAuthenticated: false, isLoading: false });
        return false;
      }

      const data: AuthResponse = (await res.json()) as AuthResponse;
      set({ user: data.data.user, isAuthenticated: true, isLoading: false });
      return true;
    } catch {
      set({ user: null, isAuthenticated: false, isLoading: false });
      return false;
    }
  },
}));

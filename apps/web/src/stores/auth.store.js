import { create } from 'zustand';
export const useAuthStore = create((set) => ({
    user: null,
    isAuthenticated: false,
    isLoading: true,
    login: async (username, password) => {
        const res = await fetch('/api/v1/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ username, password }),
        });
        if (!res.ok) {
            const error = (await res.json());
            throw new Error(error.error?.message ?? 'Login failed');
        }
        const data = (await res.json());
        set({ user: data.data.user, isAuthenticated: true, isLoading: false });
    },
    logout: async () => {
        await fetch('/api/v1/auth/logout', {
            method: 'POST',
            credentials: 'include',
        });
        set({ user: null, isAuthenticated: false, isLoading: false });
    },
    checkAuth: async () => {
        set({ isLoading: true });
        try {
            const res = await fetch('/api/v1/auth/me', {
                credentials: 'include',
            });
            if (!res.ok) {
                // If unauthorized, try to refresh the token
                if (res.status === 401) {
                    const refreshRes = await fetch('/api/v1/auth/refresh', {
                        method: 'POST',
                        credentials: 'include',
                    });
                    if (refreshRes.ok) {
                        const refreshData = (await refreshRes.json());
                        set({ user: refreshData.data.user, isAuthenticated: true, isLoading: false });
                        return true;
                    }
                }
                set({ user: null, isAuthenticated: false, isLoading: false });
                return false;
            }
            const data = (await res.json());
            set({ user: data.data.user, isAuthenticated: true, isLoading: false });
            return true;
        }
        catch {
            set({ user: null, isAuthenticated: false, isLoading: false });
            return false;
        }
    },
}));

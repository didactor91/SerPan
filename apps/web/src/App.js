import { useEffect } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useAuthStore } from './stores/auth.store';
export function App() {
    const { checkAuth } = useAuthStore();
    const navigate = useNavigate();
    useEffect(() => {
        void checkAuth().then((isAuthenticated) => {
            if (!isAuthenticated) {
                void navigate({ to: '/login' });
            }
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    return null; // Router handles rendering
}

import { useEffect } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useAuthStore } from './stores/auth.store';

export function App() {
  const { checkAuth } = useAuthStore();
  const navigate = useNavigate();

  useEffect(() => {
    checkAuth().then((isAuthenticated) => {
      if (!isAuthenticated) {
        navigate({ to: '/login' });
      }
    });
  }, []);

  return null; // Router handles rendering
}

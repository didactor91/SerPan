import React from 'react';
import { createRouter, createRoute, createRootRoute, useNavigate } from '@tanstack/react-router';
import { Layout } from './components/layout/Layout';
import { DashboardPage } from './pages/Dashboard/DashboardPage';
import { ProcessManagerPage } from './pages/ProcessManager/ProcessManagerPage';
import { LoginPage } from './pages/Login/LoginPage';
import { ProxyManagerPage } from './pages/ProxyManager/ProxyManagerPage';
import { LogViewerPage } from './pages/Logs/LogViewerPage';
import { DomainsPage } from './pages/Domains/DomainsPage';
import { useAuthStore } from './stores/auth.store';

// Auth route guard
function authGuard() {
  const { isAuthenticated } = useAuthStore.getState();
  if (!isAuthenticated) {
    throw new Error('Not authenticated');
  }
}

// Root route
const rootRoute = createRootRoute({
  component: Layout,
});

// Index route (redirect to dashboard)
const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  beforeLoad: () => {
    // Redirect to dashboard
  },
  component: function Index() {
    const navigate = useNavigate();
    React.useEffect(() => {
      void navigate({ to: '/dashboard' });
    }, [navigate]);
    return null;
  },
});

// Login route
const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/login',
  component: LoginPage,
});

// Dashboard route
const dashboardRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/dashboard',
  beforeLoad: authGuard,
  component: DashboardPage,
});

// Process Manager route
const processManagerRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/processes',
  beforeLoad: authGuard,
  component: ProcessManagerPage,
});

// Proxy Manager route
const proxyManagerRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/proxy',
  beforeLoad: authGuard,
  component: ProxyManagerPage,
});

// Logs route
const logsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/logs',
  beforeLoad: authGuard,
  component: LogViewerPage,
});

// Domains route
const domainsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/domains',
  beforeLoad: authGuard,
  component: DomainsPage,
});

// Build route tree
const routeTree = rootRoute.addChildren([
  indexRoute,
  loginRoute,
  dashboardRoute,
  processManagerRoute,
  proxyManagerRoute,
  logsRoute,
  domainsRoute,
]);

// Create router
export const router = createRouter({ routeTree });

// Type declarations for router
declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}

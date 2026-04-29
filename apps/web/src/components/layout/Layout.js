import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect } from 'react';
import { Outlet, Link, useNavigate, useLocation } from '@tanstack/react-router';
import { useAuthStore } from '@/stores/auth.store';
import { useNotificationsStore } from '@/stores/notifications.store';
import { Button } from '@/components/ui/Button';
import { clsx } from 'clsx';
const navItems = [
    {
        path: '/dashboard',
        label: 'Dashboard',
        icon: (_jsxs("svg", { xmlns: "http://www.w3.org/2000/svg", width: "18", height: "18", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round", children: [_jsx("rect", { x: "3", y: "3", width: "7", height: "9" }), _jsx("rect", { x: "14", y: "3", width: "7", height: "5" }), _jsx("rect", { x: "14", y: "12", width: "7", height: "9" }), _jsx("rect", { x: "3", y: "16", width: "7", height: "5" })] })),
    },
    {
        path: '/projects',
        label: 'Projects',
        icon: (_jsx("svg", { xmlns: "http://www.w3.org/2000/svg", width: "18", height: "18", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round", children: _jsx("path", { d: "M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" }) })),
    },
    {
        path: '/processes',
        label: 'Processes',
        icon: (_jsxs("svg", { xmlns: "http://www.w3.org/2000/svg", width: "18", height: "18", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round", children: [_jsx("rect", { x: "2", y: "3", width: "20", height: "14", rx: "2", ry: "2" }), _jsx("line", { x1: "8", y1: "21", x2: "16", y2: "21" }), _jsx("line", { x1: "12", y1: "17", x2: "12", y2: "21" })] })),
    },
    {
        path: '/proxy',
        label: 'Proxy',
        icon: (_jsxs("svg", { xmlns: "http://www.w3.org/2000/svg", width: "18", height: "18", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round", children: [_jsx("rect", { x: "3", y: "3", width: "18", height: "18", rx: "2", ry: "2" }), _jsx("line", { x1: "3", y1: "9", x2: "21", y2: "9" }), _jsx("line", { x1: "9", y1: "21", x2: "9", y2: "9" })] })),
    },
    {
        path: '/logs',
        label: 'Logs',
        icon: (_jsxs("svg", { xmlns: "http://www.w3.org/2000/svg", width: "18", height: "18", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round", children: [_jsx("path", { d: "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" }), _jsx("polyline", { points: "14 2 14 8 20 8" }), _jsx("line", { x1: "16", y1: "13", x2: "8", y2: "13" }), _jsx("line", { x1: "16", y1: "17", x2: "8", y2: "17" }), _jsx("polyline", { points: "10 9 9 9 8 9" })] })),
    },
    {
        path: '/domains',
        label: 'Domains',
        icon: (_jsxs("svg", { xmlns: "http://www.w3.org/2000/svg", width: "18", height: "18", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round", children: [_jsx("circle", { cx: "12", cy: "12", r: "10" }), _jsx("line", { x1: "2", y1: "12", x2: "22", y2: "12" }), _jsx("path", { d: "M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" })] })),
    },
];
export function Layout() {
    const { user, logout, checkAuth, isLoading } = useAuthStore();
    const { notifications } = useNotificationsStore();
    const navigate = useNavigate();
    const location = useLocation();
    // Check auth on mount
    useEffect(() => {
        if (isLoading) {
            void checkAuth();
        }
    }, [checkAuth, isLoading]);
    const handleLogout = () => {
        void logout().then(() => {
            void navigate({ to: '/login' });
        });
    };
    return (_jsxs("div", { className: "flex h-screen", children: [_jsxs("aside", { className: "w-64 border-r bg-card flex flex-col", children: [_jsx("div", { className: "p-4 border-b", children: _jsx("h1", { className: "text-lg font-bold", children: "ServerCtrl" }) }), _jsx("nav", { className: "p-4 space-y-1 flex-1", children: navItems.map((item) => {
                            const isActive = location.pathname === item.path;
                            return (_jsxs(Link, { to: item.path, className: clsx('flex items-center gap-3 px-3 py-2 rounded-md transition-colors', isActive
                                    ? 'bg-accent text-accent-foreground font-medium'
                                    : 'hover:bg-accent text-muted-foreground hover:text-foreground'), children: [item.icon, _jsx("span", { children: item.label }), isActive && _jsx("span", { className: "ml-auto h-1.5 w-1.5 rounded-full bg-primary" })] }, item.path));
                        }) }), _jsxs("div", { className: "p-4 border-t", children: [_jsx("div", { className: "text-sm text-muted-foreground mb-2", children: user?.username }), _jsx(Button, { variant: "ghost", size: "sm", onClick: handleLogout, children: "Logout" })] })] }), _jsx("main", { className: "flex-1 overflow-auto", children: _jsx(Outlet, {}) }), _jsx("div", { className: "fixed bottom-4 right-4 space-y-2", children: notifications.map((notification) => (_jsx("div", { className: `px-4 py-3 rounded-md shadow-lg ${notification.type === 'success'
                        ? 'bg-green-500'
                        : notification.type === 'error'
                            ? 'bg-red-500'
                            : notification.type === 'warning'
                                ? 'bg-yellow-500'
                                : 'bg-blue-500'} text-white`, children: notification.message }, notification.id))) })] }));
}

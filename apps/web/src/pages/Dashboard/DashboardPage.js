import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/api/client';
import { ServerSummary } from '@/components/shared/ServerSummary';
import { ProjectCard } from '@/components/shared/ProjectCard';
import { Card, CardContent } from '@/components/ui/Card';
import { useWebSocket } from '@/hooks/useWebSocket';
export function DashboardPage() {
    const [liveMetrics, setLiveMetrics] = useState(null);
    const handleMetricsUpdate = useCallback((metrics) => {
        setLiveMetrics(metrics);
    }, []);
    // Connect WebSocket for live metrics
    useWebSocket({ onMetricsUpdate: handleMetricsUpdate });
    const { data: processesData, isLoading, error, } = useQuery({
        queryKey: ['processes'],
        queryFn: () => apiClient.get('/processes'),
        refetchInterval: 5000, // Refresh every 5s
    });
    const processes = processesData?.data.processes ?? [];
    if (isLoading) {
        return (_jsxs("div", { className: "p-6", children: [_jsx("h1", { className: "text-2xl font-bold mb-6", children: "Dashboard" }), _jsx("p", { className: "text-muted-foreground", children: "Loading..." })] }));
    }
    if (error) {
        return (_jsxs("div", { className: "p-6", children: [_jsx("h1", { className: "text-2xl font-bold mb-6", children: "Dashboard" }), _jsx("p", { className: "text-destructive", children: "Failed to load dashboard data" })] }));
    }
    return (_jsxs("div", { className: "p-6", children: [_jsx("h1", { className: "text-2xl font-bold mb-6", children: "Dashboard" }), _jsxs("div", { className: "space-y-6", children: [_jsx(ServerSummary, { liveMetrics: liveMetrics }), _jsxs("div", { children: [_jsx("h2", { className: "text-lg font-semibold mb-4", children: "Projects" }), processes.length === 0 ? (_jsx(Card, { children: _jsx(CardContent, { className: "p-6", children: _jsx("p", { className: "text-muted-foreground", children: "No projects found" }) }) })) : (_jsx("div", { className: "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4", children: processes.map((process) => (_jsx(ProjectCard, { name: process.name, process: process }, process.name))) }))] })] })] }));
}

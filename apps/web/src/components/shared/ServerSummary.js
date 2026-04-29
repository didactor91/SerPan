import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/api/client';
import { MetricCard } from './MetricCard';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
export function ServerSummary({ liveMetrics }) {
    const { data, isLoading, error } = useQuery({
        queryKey: ['system', 'metrics'],
        queryFn: () => apiClient.get('/system/metrics'),
        refetchInterval: 10000, // Refresh every 10s
    });
    // Use live metrics when available, fall back to query data
    const metrics = liveMetrics ?? data?.data;
    if (isLoading && !metrics) {
        return (_jsxs(Card, { children: [_jsx(CardHeader, { children: _jsx(CardTitle, { children: "Server Overview" }) }), _jsx(CardContent, { children: _jsx("p", { className: "text-muted-foreground", children: "Loading..." }) })] }));
    }
    if (error && !metrics) {
        return (_jsxs(Card, { children: [_jsx(CardHeader, { children: _jsx(CardTitle, { children: "Server Overview" }) }), _jsx(CardContent, { children: _jsx("p", { className: "text-destructive", children: "Failed to load metrics" }) })] }));
    }
    if (!metrics) {
        return (_jsxs(Card, { children: [_jsx(CardHeader, { children: _jsx(CardTitle, { children: "Server Overview" }) }), _jsx(CardContent, { children: _jsx("p", { className: "text-muted-foreground", children: "No metrics available" }) })] }));
    }
    const { cpu, memory, disk } = metrics;
    return (_jsxs(Card, { children: [_jsx(CardHeader, { children: _jsx(CardTitle, { children: "Server Overview" }) }), _jsxs(CardContent, { className: "grid grid-cols-3 gap-4", children: [_jsx(MetricCard, { label: "CPU", value: cpu.usage.toFixed(1), unit: "%" }), _jsx(MetricCard, { label: "Memory", value: memory.usagePercent.toFixed(1), unit: "%" }), _jsx(MetricCard, { label: "Disk", value: disk.usagePercent.toFixed(1), unit: "%" })] })] }));
}

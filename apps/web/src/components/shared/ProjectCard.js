import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { StatusBadge } from './StatusBadge';
export function ProjectCard({ name, domain, process }) {
    const formatUptime = (ms) => {
        const seconds = Math.floor(ms / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);
        if (days > 0)
            return String(days) + 'd ' + String(hours % 24) + 'h';
        if (hours > 0)
            return String(hours) + 'h ' + String(minutes % 60) + 'm';
        return String(minutes) + 'm';
    };
    const formatMemory = (bytes) => {
        const mb = bytes / (1024 * 1024);
        return mb.toFixed(0) + 'MB';
    };
    return (_jsxs(Card, { children: [_jsxs(CardHeader, { className: "pb-2", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsx(CardTitle, { className: "text-lg", children: name }), _jsx(StatusBadge, { status: process.status })] }), domain && _jsx("p", { className: "text-sm text-muted-foreground", children: domain })] }), _jsx(CardContent, { children: _jsxs("div", { className: "grid grid-cols-3 gap-2 text-sm", children: [_jsxs("div", { children: [_jsx("p", { className: "text-muted-foreground", children: "CPU" }), _jsxs("p", { className: "font-medium", children: [process.cpu.toFixed(1), "%"] })] }), _jsxs("div", { children: [_jsx("p", { className: "text-muted-foreground", children: "Memory" }), _jsx("p", { className: "font-medium", children: formatMemory(process.memory) })] }), _jsxs("div", { children: [_jsx("p", { className: "text-muted-foreground", children: "Uptime" }), _jsx("p", { className: "font-medium", children: formatUptime(process.uptime) })] })] }) })] }));
}

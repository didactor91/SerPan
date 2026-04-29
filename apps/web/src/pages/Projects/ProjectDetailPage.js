import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { useParams } from '@tanstack/react-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/api/client';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Input } from '@/components/ui/Input';
export function ProjectDetailPage() {
    const { slug } = useParams({ from: '/projects/$slug' });
    const queryClient = useQueryClient();
    const [isEditing, setIsEditing] = useState(false);
    const [editedDomain, setEditedDomain] = useState('');
    const [editedPort, setEditedPort] = useState('');
    const { data, isLoading, error } = useQuery({
        queryKey: ['project', slug],
        queryFn: () => apiClient.get(`/projects/${slug}`),
        enabled: !!slug,
    });
    const { data: processesData } = useQuery({
        queryKey: ['project-processes', slug],
        queryFn: () => apiClient.get(`/projects/${slug}/processes`),
        enabled: !!slug,
        refetchInterval: 10000,
    });
    const { data: logsData } = useQuery({
        queryKey: ['project-logs', slug],
        queryFn: () => apiClient.get(`/projects/${slug}/logs`),
        enabled: !!slug,
    });
    const healthMutation = useMutation({
        mutationFn: () => apiClient.get(`/projects/${slug}/health`),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['project', slug] }),
    });
    const updateProjectMutation = useMutation({
        mutationFn: (updates) => apiClient.put(`/projects/${slug}`, updates),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['project', slug] });
            setIsEditing(false);
        },
    });
    const restartMutation = useMutation({
        mutationFn: () => apiClient.post(`/projects/${slug}/restart`, {}),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['project-processes', slug] }),
    });
    const deleteMutation = useMutation({
        mutationFn: () => apiClient.delete(`/projects/${slug}`),
        onSuccess: () => {
            window.location.href = '/projects';
        },
    });
    if (isLoading)
        return _jsx("div", { children: "Loading..." });
    if (error || !data?.data)
        return _jsx("div", { children: "Project not found" });
    const project = data.data;
    const instances = project.instances || [];
    const processes = processesData?.data.processes ?? [];
    const getStatusColor = (status) => {
        switch (status) {
            case 'running':
            case 'online':
                return 'bg-green-500';
            case 'stopped':
                return 'bg-yellow-500';
            case 'error':
            case 'errored':
                return 'bg-red-500';
            default:
                return 'bg-gray-500';
        }
    };
    const formatUptime = (ms) => {
        if (!ms)
            return '-';
        const seconds = Math.floor(ms / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);
        if (days > 0)
            return `${days}d ${hours % 24}h`;
        if (hours > 0)
            return `${hours}h ${minutes % 60}m`;
        return `${minutes}m`;
    };
    const formatMemory = (bytes) => {
        if (!bytes)
            return '-';
        const mb = bytes / (1024 * 1024);
        return mb.toFixed(0) + 'MB';
    };
    const handleStartEdit = () => {
        setEditedDomain(project.domain || '');
        setEditedPort(project.healthCheckPort?.toString() || '');
        setIsEditing(true);
    };
    const handleSaveEdit = () => {
        const updates = {};
        if (editedDomain !== project.domain)
            updates.domain = editedDomain;
        if (editedPort && parseInt(editedPort) !== project.healthCheckPort) {
            updates.healthCheckPort = parseInt(editedPort);
        }
        if (Object.keys(updates).length > 0) {
            updateProjectMutation.mutate(updates);
        }
        else {
            setIsEditing(false);
        }
    };
    return (_jsxs("div", { className: "p-6 space-y-6", children: [_jsxs("div", { className: "flex justify-between items-center", children: [_jsx("h1", { className: "text-2xl font-bold", children: project.name }), _jsxs("div", { className: "space-x-2", children: [_jsx(Button, { onClick: () => healthMutation.mutate(), children: healthMutation.isPending ? 'Checking...' : 'Check Health' }), _jsx(Button, { onClick: () => restartMutation.mutate(), disabled: restartMutation.isPending, children: restartMutation.isPending ? 'Restarting...' : 'Restart' }), _jsx(Button, { variant: "destructive", onClick: () => deleteMutation.mutate(), children: "Delete" })] })] }), _jsxs("div", { className: "grid grid-cols-1 md:grid-cols-2 gap-4", children: [_jsxs(Card, { children: [_jsx(CardHeader, { children: _jsxs("div", { className: "flex justify-between items-center", children: [_jsx(CardTitle, { children: "Project Info" }), !isEditing ? (_jsx(Button, { size: "sm", variant: "outline", onClick: handleStartEdit, children: "Edit" })) : (_jsxs("div", { className: "flex gap-2", children: [_jsx(Button, { size: "sm", onClick: handleSaveEdit, children: "Save" }), _jsx(Button, { size: "sm", variant: "ghost", onClick: () => setIsEditing(false), children: "Cancel" })] }))] }) }), _jsx(CardContent, { children: _jsxs("div", { className: "space-y-3 text-sm", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsx("span", { className: "text-muted-foreground", children: "Status:" }), _jsx(Badge, { className: getStatusColor(project.status), children: project.status })] }), _jsxs("div", { className: "flex items-center justify-between", children: [_jsx("span", { className: "text-muted-foreground", children: "Type:" }), _jsx("span", { children: project.type })] }), _jsxs("div", { className: "flex items-center justify-between", children: [_jsx("span", { className: "text-muted-foreground", children: "Path:" }), _jsx("code", { className: "text-xs bg-muted px-1 rounded", children: project.path })] }), _jsxs("div", { className: "flex items-center justify-between", children: [_jsx("span", { className: "text-muted-foreground", children: "Domain:" }), isEditing ? (_jsx(Input, { value: editedDomain, onChange: (e) => setEditedDomain(e.target.value), className: "w-48 h-8 text-sm", placeholder: "domain.example.com" })) : (_jsx("span", { children: project.domain || '-' }))] }), _jsxs("div", { className: "flex items-center justify-between", children: [_jsx("span", { className: "text-muted-foreground", children: "Port:" }), isEditing ? (_jsx(Input, { value: editedPort, onChange: (e) => setEditedPort(e.target.value), className: "w-20 h-8 text-sm", placeholder: "3000" })) : (_jsx("span", { children: project.healthCheckPort || '-' }))] }), project.lastHealthCheck && (_jsxs("div", { className: "flex items-center justify-between", children: [_jsx("span", { className: "text-muted-foreground", children: "Last Check:" }), _jsx("span", { className: "text-xs", children: project.lastHealthCheck })] }))] }) })] }), _jsxs(Card, { children: [_jsx(CardHeader, { children: _jsx(CardTitle, { children: "PM2 Processes" }) }), _jsx(CardContent, { children: processes.length === 0 ? (_jsx("p", { className: "text-muted-foreground text-sm", children: "No PM2 processes found for this project" })) : (_jsx("div", { className: "space-y-2", children: processes.map((proc) => (_jsxs("div", { className: "flex justify-between items-center p-2 border rounded", children: [_jsxs("div", { children: [_jsx("p", { className: "text-sm font-medium", children: proc.name }), _jsxs("p", { className: "text-xs text-muted-foreground", children: ["PID: ", proc.pid, " | CPU: ", proc.cpu.toFixed(1), "% | RAM:", ' ', formatMemory(proc.memory)] })] }), _jsxs("div", { className: "flex items-center gap-2", children: [_jsx(Badge, { className: getStatusColor(proc.status), children: proc.status }), _jsx("span", { className: "text-xs text-muted-foreground", children: formatUptime(proc.uptime) })] })] }, proc.name))) })) })] })] }), _jsxs(Card, { children: [_jsx(CardHeader, { children: _jsx(CardTitle, { children: "Recent Logs" }) }), _jsx(CardContent, { children: !logsData?.data?.logs || logsData.data.logs.length === 0 ? (_jsx("p", { className: "text-muted-foreground text-sm", children: "No logs available" })) : (_jsx("div", { className: "bg-muted rounded p-4 font-mono text-xs overflow-auto max-h-64", children: logsData.data.logs.map((line, i) => (_jsx("div", { className: "whitespace-pre-wrap", children: line }, i))) })) })] }), _jsxs(Card, { children: [_jsx(CardHeader, { children: _jsx(CardTitle, { children: "Instances" }) }), _jsx(CardContent, { children: instances.length === 0 ? (_jsx("p", { className: "text-muted-foreground text-sm", children: "No instances linked" })) : (_jsx("div", { className: "space-y-2", children: instances.map((instance) => (_jsxs("div", { className: "flex justify-between items-center p-2 border rounded", children: [_jsxs("div", { children: [_jsx("p", { className: "text-sm font-medium", children: instance.serverName }), _jsxs("p", { className: "text-xs text-muted-foreground", children: [instance.pm2Name ? `PM2: ${instance.pm2Name}` : '', instance.port ? ` Port: ${instance.port}` : '', instance.pid ? ` PID: ${instance.pid}` : ''] })] }), instance.containerStatus && (_jsx(Badge, { className: getStatusColor(instance.containerStatus), children: instance.containerStatus }))] }, instance.id))) })) })] })] }));
}

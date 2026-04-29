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
    const [selectedContainerLogs, setSelectedContainerLogs] = useState(null);
    const { data, isLoading, error } = useQuery({
        queryKey: ['project', slug],
        queryFn: () => apiClient.get(`/projects/${slug}`),
        enabled: !!slug,
    });
    const { data: metricsData, refetch: refetchMetrics } = useQuery({
        queryKey: ['project-metrics', slug],
        queryFn: () => apiClient.get(`/projects/${slug}/metrics`),
        enabled: !!slug,
        refetchInterval: 10000,
    });
    const { data: logsData } = useQuery({
        queryKey: ['project-logs', slug],
        queryFn: () => apiClient.get(`/projects/${slug}/logs`),
        enabled: !!slug,
    });
    const { data: containerLogsData, refetch: refetchContainerLogs } = useQuery({
        queryKey: ['container-logs', selectedContainerLogs],
        queryFn: () => apiClient.get(`/projects/${slug}/containers/${selectedContainerLogs}/logs`),
        enabled: !!slug && !!selectedContainerLogs,
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
        onSuccess: () => {
            refetchMetrics();
        },
    });
    const containerActionMutation = useMutation({
        mutationFn: ({ name, action }) => apiClient.post(`/projects/${slug}/containers/${name}/${action}`, {}),
        onSuccess: () => {
            refetchMetrics();
        },
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
    const processes = metricsData?.data?.processes ?? [];
    const containers = metricsData?.data?.containers ?? [];
    const getStatusColor = (status) => {
        switch (status) {
            case 'running':
            case 'online':
            case 'Up':
                return 'bg-green-500';
            case 'stopped':
            case 'Exited':
                return 'bg-yellow-500';
            case 'error':
            case 'errored':
            case 'Restarting':
            case 'Dead':
                return 'bg-red-500';
            default:
                return 'bg-gray-500';
        }
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
    return (_jsxs("div", { className: "p-6 space-y-6", children: [_jsxs("div", { className: "flex justify-between items-center", children: [_jsx("h1", { className: "text-2xl font-bold", children: project.name }), _jsxs("div", { className: "space-x-2", children: [_jsx(Button, { onClick: () => healthMutation.mutate(), children: healthMutation.isPending ? 'Checking...' : 'Check Health' }), _jsx(Button, { onClick: () => restartMutation.mutate(), disabled: restartMutation.isPending, children: restartMutation.isPending ? 'Restarting...' : 'Restart All' }), _jsx(Button, { variant: "destructive", onClick: () => deleteMutation.mutate(), children: "Delete" })] })] }), _jsxs("div", { className: "grid grid-cols-1 md:grid-cols-2 gap-4", children: [_jsxs(Card, { children: [_jsx(CardHeader, { children: _jsxs("div", { className: "flex justify-between items-center", children: [_jsx(CardTitle, { children: "Project Info" }), !isEditing ? (_jsx(Button, { size: "sm", variant: "outline", onClick: handleStartEdit, children: "Edit" })) : (_jsxs("div", { className: "flex gap-2", children: [_jsx(Button, { size: "sm", onClick: handleSaveEdit, children: "Save" }), _jsx(Button, { size: "sm", variant: "ghost", onClick: () => setIsEditing(false), children: "Cancel" })] }))] }) }), _jsx(CardContent, { children: _jsxs("div", { className: "space-y-3 text-sm", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsx("span", { className: "text-muted-foreground", children: "Status:" }), _jsx(Badge, { className: getStatusColor(project.status), children: project.status })] }), _jsxs("div", { className: "flex items-center justify-between", children: [_jsx("span", { className: "text-muted-foreground", children: "Type:" }), _jsx("span", { children: project.type })] }), _jsxs("div", { className: "flex items-center justify-between", children: [_jsx("span", { className: "text-muted-foreground", children: "Path:" }), _jsx("code", { className: "text-xs bg-muted px-1 rounded", children: project.path })] }), _jsxs("div", { className: "flex items-center justify-between", children: [_jsx("span", { className: "text-muted-foreground", children: "Domain:" }), isEditing ? (_jsx(Input, { value: editedDomain, onChange: (e) => setEditedDomain(e.target.value), className: "w-48 h-8 text-sm", placeholder: "domain.example.com" })) : (_jsx("span", { children: project.domain || '-' }))] }), _jsxs("div", { className: "flex items-center justify-between", children: [_jsx("span", { className: "text-muted-foreground", children: "Port:" }), isEditing ? (_jsx(Input, { value: editedPort, onChange: (e) => setEditedPort(e.target.value), className: "w-20 h-8 text-sm", placeholder: "3000" })) : (_jsx("span", { children: project.healthCheckPort || '-' }))] }), project.lastHealthCheck && (_jsxs("div", { className: "flex items-center justify-between", children: [_jsx("span", { className: "text-muted-foreground", children: "Last Check:" }), _jsx("span", { className: "text-xs", children: project.lastHealthCheck })] }))] }) })] }), _jsxs(Card, { children: [_jsx(CardHeader, { children: _jsx(CardTitle, { children: "System Resources" }) }), _jsx(CardContent, { children: _jsxs("div", { className: "space-y-2", children: [_jsx("p", { className: "text-xs text-muted-foreground", children: "Project-specific resource usage:" }), processes.length === 0 && containers.length === 0 ? (_jsx("p", { className: "text-muted-foreground text-sm", children: "No processes or containers found" })) : (_jsxs("div", { className: "space-y-2", children: [processes.map((proc) => (_jsxs("div", { className: "flex justify-between items-center p-2 border rounded", children: [_jsxs("div", { children: [_jsx("p", { className: "text-sm font-medium", children: proc.name }), _jsxs("p", { className: "text-xs text-muted-foreground", children: ["PID: ", proc.pid, " | CPU: ", proc.cpu.toFixed(1), "% | RAM:", ' ', formatMemory(proc.memory)] })] }), _jsx(Badge, { className: getStatusColor(proc.status), children: proc.status })] }, proc.name))), containers.map((container) => (_jsxs("div", { className: "flex justify-between items-center p-2 border rounded", children: [_jsxs("div", { children: [_jsx("p", { className: "text-sm font-medium", children: container.name }), _jsxs("p", { className: "text-xs text-muted-foreground", children: [container.image, " | CPU: ", container.cpuPercent.toFixed(1), "% | RAM:", ' ', container.memoryUsage] })] }), _jsx("div", { className: "flex items-center gap-2", children: _jsx(Badge, { className: getStatusColor(container.state), children: container.state }) })] }, container.name)))] }))] }) })] })] }), _jsxs(Card, { children: [_jsx(CardHeader, { children: _jsx(CardTitle, { children: "Containers" }) }), _jsx(CardContent, { children: containers.length === 0 ? (_jsx("p", { className: "text-muted-foreground text-sm", children: "No Docker containers found for this project" })) : (_jsx("div", { className: "space-y-2", children: containers.map((container) => (_jsxs("div", { className: "border rounded p-3", children: [_jsxs("div", { className: "flex justify-between items-center mb-2", children: [_jsxs("div", { children: [_jsx("p", { className: "font-medium", children: container.name }), _jsxs("p", { className: "text-xs text-muted-foreground", children: [container.image, " | ID: ", container.id.slice(0, 12)] })] }), _jsx(Badge, { className: getStatusColor(container.state), children: container.state })] }), _jsxs("div", { className: "flex items-center gap-2 mb-2", children: [_jsxs("span", { className: "text-xs", children: ["CPU: ", container.cpuPercent.toFixed(1), "%"] }), _jsxs("span", { className: "text-xs", children: ["RAM: ", container.memoryUsage] }), _jsxs("span", { className: "text-xs text-muted-foreground", children: ["Status: ", container.status] })] }), _jsxs("div", { className: "flex gap-2", children: [_jsx(Button, { size: "sm", variant: "outline", onClick: () => containerActionMutation.mutate({ name: container.name, action: 'start' }), disabled: containerActionMutation.isPending || container.state === 'Up', children: "Start" }), _jsx(Button, { size: "sm", variant: "outline", onClick: () => containerActionMutation.mutate({ name: container.name, action: 'stop' }), disabled: containerActionMutation.isPending || container.state !== 'Up', children: "Stop" }), _jsx(Button, { size: "sm", variant: "outline", onClick: () => containerActionMutation.mutate({ name: container.name, action: 'restart' }), disabled: containerActionMutation.isPending, children: "Restart" }), _jsx(Button, { size: "sm", variant: "ghost", onClick: () => {
                                                    setSelectedContainerLogs(container.name);
                                                    void refetchContainerLogs();
                                                }, children: "View Logs" })] })] }, container.name))) })) })] }), selectedContainerLogs && (_jsxs(Card, { children: [_jsx(CardHeader, { children: _jsxs("div", { className: "flex justify-between items-center", children: [_jsxs(CardTitle, { children: ["Logs: ", selectedContainerLogs] }), _jsx(Button, { size: "sm", variant: "ghost", onClick: () => setSelectedContainerLogs(null), children: "Close" })] }) }), _jsx(CardContent, { children: _jsx("div", { className: "bg-muted rounded p-4 font-mono text-xs overflow-auto max-h-64", children: containerLogsData?.data?.logs && containerLogsData.data.logs.length > 0 ? (containerLogsData.data.logs.map((line, i) => (_jsx("div", { className: "whitespace-pre-wrap", children: line }, i)))) : (_jsx("p", { className: "text-muted-foreground", children: "No logs available" })) }) })] })), _jsxs(Card, { children: [_jsx(CardHeader, { children: _jsx(CardTitle, { children: "Recent Logs (PM2)" }) }), _jsx(CardContent, { children: !logsData?.data?.logs || logsData.data.logs.length === 0 ? (_jsx("p", { className: "text-muted-foreground text-sm", children: "No logs available" })) : (_jsx("div", { className: "bg-muted rounded p-4 font-mono text-xs overflow-auto max-h-64", children: logsData.data.logs.map((line, i) => (_jsx("div", { className: "whitespace-pre-wrap", children: line }, i))) })) })] }), _jsxs(Card, { children: [_jsx(CardHeader, { children: _jsx(CardTitle, { children: "Instances" }) }), _jsx(CardContent, { children: instances.length === 0 ? (_jsx("p", { className: "text-muted-foreground text-sm", children: "No instances linked" })) : (_jsx("div", { className: "space-y-2", children: instances.map((instance) => (_jsxs("div", { className: "flex justify-between items-center p-2 border rounded", children: [_jsxs("div", { children: [_jsx("p", { className: "text-sm font-medium", children: instance.serverName }), _jsxs("p", { className: "text-xs text-muted-foreground", children: [instance.pm2Name ? `PM2: ${instance.pm2Name}` : '', instance.port ? ` Port: ${instance.port}` : '', instance.pid ? ` PID: ${instance.pid}` : ''] })] }), instance.containerStatus && (_jsx(Badge, { className: getStatusColor(instance.containerStatus), children: instance.containerStatus }))] }, instance.id))) })) })] })] }));
}

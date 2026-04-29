import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useParams } from '@tanstack/react-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/api/client';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
export function ProjectDetailPage() {
    const { slug } = useParams({ from: '/projects/$slug' });
    const queryClient = useQueryClient();
    const { data, isLoading, error } = useQuery({
        queryKey: ['project', slug],
        queryFn: () => apiClient.get(`/projects/${slug}`),
        enabled: !!slug,
    });
    const healthMutation = useMutation({
        mutationFn: () => apiClient.get(`/projects/${slug}/health`),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['project', slug] }),
    });
    const restartMutation = useMutation({
        mutationFn: (instanceId) => apiClient.post(`/projects/${slug}/instances/${instanceId}/restart`, {}),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['project', slug] }),
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
    const getStatusColor = (status) => {
        switch (status) {
            case 'running':
                return 'bg-green-500';
            case 'stopped':
                return 'bg-yellow-500';
            case 'error':
                return 'bg-red-500';
            default:
                return 'bg-gray-500';
        }
    };
    return (_jsxs("div", { className: "p-6 space-y-6", children: [_jsxs("div", { className: "flex justify-between items-center", children: [_jsx("h1", { className: "text-2xl font-bold", children: project.name }), _jsxs("div", { className: "space-x-2", children: [_jsx(Button, { onClick: () => healthMutation.mutate(), children: healthMutation.isPending ? 'Checking...' : 'Check Health' }), _jsx(Button, { variant: "destructive", onClick: () => deleteMutation.mutate(), children: "Delete" })] })] }), _jsxs("div", { className: "grid grid-cols-1 md:grid-cols-2 gap-4", children: [_jsxs(Card, { children: [_jsx(CardHeader, { children: _jsx(CardTitle, { children: "Project Info" }) }), _jsx(CardContent, { children: _jsxs("div", { className: "space-y-2 text-sm", children: [_jsxs("p", { children: [_jsx("span", { className: "text-muted-foreground", children: "Slug:" }), " ", project.slug] }), _jsxs("p", { children: [_jsx("span", { className: "text-muted-foreground", children: "Type:" }), " ", project.type] }), _jsxs("p", { children: [_jsx("span", { className: "text-muted-foreground", children: "Path:" }), " ", project.path] }), _jsxs("p", { children: [_jsx("span", { className: "text-muted-foreground", children: "Status:" }), ' ', _jsx(Badge, { className: getStatusColor(project.status), children: project.status })] }), project.domain && (_jsxs("p", { children: [_jsx("span", { className: "text-muted-foreground", children: "Domain:" }), " ", project.domain] })), project.healthCheckUrl && (_jsxs("p", { children: [_jsx("span", { className: "text-muted-foreground", children: "Health URL:" }), ' ', project.healthCheckUrl] })), project.lastHealthCheck && (_jsxs("p", { children: [_jsx("span", { className: "text-muted-foreground", children: "Last Check:" }), ' ', project.lastHealthCheck] })), project.lastDeploy && (_jsxs("p", { children: [_jsx("span", { className: "text-muted-foreground", children: "Last Deploy:" }), " ", project.lastDeploy] }))] }) })] }), _jsxs(Card, { children: [_jsx(CardHeader, { children: _jsx(CardTitle, { children: "Instances" }) }), _jsx(CardContent, { children: instances.length === 0 ? (_jsx("p", { className: "text-muted-foreground text-sm", children: "No instances linked" })) : (_jsx("div", { className: "space-y-2", children: instances.map((instance) => (_jsxs("div", { className: "flex justify-between items-center p-2 border rounded", children: [_jsxs("div", { children: [_jsx("p", { className: "text-sm font-medium", children: instance.serverName }), _jsxs("p", { className: "text-xs text-muted-foreground", children: [instance.pm2Name ? `PM2: ${instance.pm2Name}` : '', instance.port ? `Port: ${instance.port}` : '', instance.pid ? ` PID: ${instance.pid}` : ''] })] }), _jsxs("div", { className: "flex items-center gap-2", children: [instance.pm2Name && (_jsx(Button, { size: "sm", variant: "outline", onClick: () => restartMutation.mutate(instance.id), disabled: restartMutation.isPending, children: restartMutation.isPending ? 'Restarting...' : 'Restart' })), instance.containerStatus && (_jsx(Badge, { className: getStatusColor(instance.containerStatus), children: instance.containerStatus }))] })] }, instance.id))) })) })] })] })] }));
}

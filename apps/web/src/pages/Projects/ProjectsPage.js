import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/api/client';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
export function ProjectsPage() {
    const queryClient = useQueryClient();
    const { data, isLoading, error } = useQuery({
        queryKey: ['projects'],
        queryFn: () => apiClient.get('/projects'),
    });
    const discoverMutation = useMutation({
        mutationFn: () => apiClient.get('/projects/discover'),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['projects'] }),
    });
    const projects = data?.data ?? [];
    if (isLoading)
        return _jsx("div", { children: "Loading..." });
    if (error)
        return _jsx("div", { children: "Error loading projects" });
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
    return (_jsxs("div", { className: "p-6 space-y-6", children: [_jsxs("div", { className: "flex justify-between items-center", children: [_jsx("h1", { className: "text-2xl font-bold", children: "Projects" }), _jsx("div", { className: "space-x-2", children: _jsx(Button, { onClick: () => discoverMutation.mutate(), children: discoverMutation.isPending ? 'Discovering...' : 'Discover Projects' }) })] }), discoverMutation.data && (_jsx(Card, { children: _jsxs(CardContent, { children: [_jsxs("p", { children: ["Discovered ", discoverMutation.data.data.discovered, " new projects"] }), discoverMutation.data.data.errors.length > 0 && (_jsxs("p", { className: "text-destructive text-sm mt-2", children: ["Errors: ", discoverMutation.data.data.errors.join(', ')] }))] }) })), projects.length === 0 ? (_jsx(Card, { children: _jsx(CardContent, { children: _jsx("p", { className: "text-muted-foreground", children: "No projects found. Add a serpan.json to your project directories or create a project manually." }) }) })) : (_jsx("div", { className: "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4", children: projects.map((project) => (_jsxs(Card, { className: "hover:shadow-md transition-shadow", children: [_jsx(CardHeader, { children: _jsxs("div", { className: "flex justify-between items-start", children: [_jsx(CardTitle, { children: project.name }), _jsx(Badge, { className: getStatusColor(project.status), children: project.status })] }) }), _jsx(CardContent, { children: _jsxs("div", { className: "space-y-2 text-sm", children: [_jsxs("p", { children: [_jsx("span", { className: "text-muted-foreground", children: "Slug:" }), " ", project.slug] }), _jsxs("p", { children: [_jsx("span", { className: "text-muted-foreground", children: "Type:" }), " ", project.type] }), _jsxs("p", { children: [_jsx("span", { className: "text-muted-foreground", children: "Path:" }), " ", project.path] }), project.domain && (_jsxs("p", { children: [_jsx("span", { className: "text-muted-foreground", children: "Domain:" }), " ", project.domain] }))] }) })] }, project.id))) }))] }));
}

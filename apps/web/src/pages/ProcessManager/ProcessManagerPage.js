import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/api/client';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';
import { useNotificationsStore } from '@/stores/notifications.store';
import { useWebSocket } from '@/hooks/useWebSocket';
function formatUptime(ms) {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    if (days > 0)
        return String(days) + 'd ' + String(hours % 24) + 'h';
    if (hours > 0)
        return String(hours) + 'h ' + String(minutes % 60) + 'm';
    return String(minutes) + 'm';
}
function formatMemory(bytes) {
    const mb = bytes / (1024 * 1024);
    return mb.toFixed(0) + 'MB';
}
function ProcessRow({ proc, scalingProcess, scaleInstances, isScalingPending, onStartScaling, onCancelScaling, onStartEdit, onAction, isActionPending, }) {
    const isScaling = scalingProcess === proc.name;
    return (_jsxs("tr", { className: "border-b", children: [_jsx("td", { className: "p-3 font-medium", children: proc.name }), _jsx("td", { className: "p-3", children: _jsx(StatusBadge, { status: proc.status }) }), _jsx("td", { className: "p-3 text-right text-muted-foreground", children: proc.pid }), _jsxs("td", { className: "p-3 text-right", children: [proc.cpu.toFixed(1), "%"] }), _jsx("td", { className: "p-3 text-right", children: formatMemory(proc.memory) }), _jsx("td", { className: "p-3 text-right", children: isScaling ? (_jsxs("div", { className: "flex items-center justify-end gap-1", children: [_jsx("input", { type: "number", min: "1", value: scaleInstances, onChange: (e) => onStartScaling(proc.name, parseInt(e.target.value) || 1), className: "w-16 h-7 text-sm border rounded px-1" }), _jsx(Button, { size: "sm", onClick: () => onStartScaling(proc.name, parseInt(scaleInstances) || 1), disabled: isScalingPending, children: "\u2713" }), _jsx(Button, { size: "sm", variant: "ghost", onClick: onCancelScaling, children: "\u2715" })] })) : (_jsx("span", { className: "cursor-pointer hover:text-primary", onClick: () => onStartEdit(proc.name, proc.instances), children: proc.instances })) }), _jsx("td", { className: "p-3 text-right text-muted-foreground", children: formatUptime(proc.uptime) }), _jsx("td", { className: "p-3 text-right", children: _jsxs("div", { className: "flex items-center justify-end gap-1", children: [_jsx(Button, { size: "sm", variant: "outline", onClick: () => onAction(proc.name, 'start'), disabled: proc.status === 'online' || isActionPending, title: "Start", children: "\u25B6" }), _jsx(Button, { size: "sm", variant: "outline", onClick: () => onAction(proc.name, 'stop'), disabled: proc.status === 'stopped' || isActionPending, title: "Stop", children: "\u25A0" }), _jsx(Button, { size: "sm", variant: "outline", onClick: () => onAction(proc.name, 'restart'), disabled: isActionPending, title: "Restart", children: "\u21BA" })] }) })] }, proc.name));
}
function ProcessTable({ processes, scalingProcess, scaleInstances, scaleMutation, processMutation, onStartEdit, onCancelScaling, }) {
    return (_jsx(Card, { children: _jsx(CardContent, { className: "p-0", children: _jsxs("table", { className: "w-full", children: [_jsx("thead", { children: _jsxs("tr", { className: "border-b bg-muted/50", children: [_jsx("th", { className: "text-left p-3 font-medium", children: "Name" }), _jsx("th", { className: "text-left p-3 font-medium", children: "Status" }), _jsx("th", { className: "text-right p-3 font-medium", children: "PID" }), _jsx("th", { className: "text-right p-3 font-medium", children: "CPU" }), _jsx("th", { className: "text-right p-3 font-medium", children: "RAM" }), _jsx("th", { className: "text-right p-3 font-medium", children: "Workers" }), _jsx("th", { className: "text-right p-3 font-medium", children: "Uptime" }), _jsx("th", { className: "text-right p-3 font-medium", children: "Actions" })] }) }), _jsx("tbody", { children: processes.map((proc) => (_jsx(ProcessRow, { proc: proc, scalingProcess: scalingProcess, scaleInstances: scaleInstances, isScalingPending: scaleMutation.isPending, onStartScaling: (name, instances) => scaleMutation.mutate({ name, instances }), onCancelScaling: onCancelScaling, onStartEdit: onStartEdit, onAction: (name, action) => processMutation.mutate({ name, action }), isActionPending: processMutation.isPending }, proc.name))) })] }) }) }));
}
function PageHeader() {
    return _jsx("h1", { className: "text-2xl font-bold mb-6", children: "Process Manager" });
}
function useProcessMutations(queryClient, add, setScalingProcess, setScaleInstances) {
    const processMutation = useMutation({
        mutationFn: ({ name, action }) => {
            return apiClient.post(`/processes/${name}/${action}`);
        },
        onSuccess: (_data, variables) => {
            void queryClient.invalidateQueries({ queryKey: ['processes'] });
            add({ type: 'success', message: 'Process ' + variables.name + ' ' + variables.action + 'd' });
        },
        onError: (error, variables) => {
            add({
                type: 'error',
                message: 'Failed to ' +
                    variables.action +
                    ' ' +
                    variables.name +
                    ': ' +
                    (error instanceof Error ? error.message : 'Unknown error'),
            });
        },
    });
    const scaleMutation = useMutation({
        mutationFn: ({ name, instances }) => {
            return apiClient.post(`/processes/${name}/scale`, { instances });
        },
        onSuccess: (_data, variables) => {
            void queryClient.invalidateQueries({ queryKey: ['processes'] });
            setScalingProcess(null);
            setScaleInstances('');
            add({
                type: 'success',
                message: 'Process ' + variables.name + ' scaled to ' + String(variables.instances),
            });
        },
        onError: (error, variables) => {
            add({
                type: 'error',
                message: 'Failed to scale ' +
                    variables.name +
                    ': ' +
                    (error instanceof Error ? error.message : 'Unknown error'),
            });
        },
    });
    return { processMutation, scaleMutation };
}
export function ProcessManagerPage() {
    const queryClient = useQueryClient();
    const { add } = useNotificationsStore();
    const [scalingProcess, setScalingProcess] = useState(null);
    const [scaleInstances, setScaleInstances] = useState('');
    const handleProcessStatusChange = useCallback(() => {
        void queryClient.invalidateQueries({ queryKey: ['processes'] });
    }, [queryClient]);
    useWebSocket({ onProcessStatusChange: handleProcessStatusChange });
    const { data, isLoading, error } = useQuery({
        queryKey: ['processes'],
        queryFn: () => apiClient.get('/processes'),
        refetchInterval: 5000,
    });
    const processes = data?.data.processes ?? [];
    const { processMutation, scaleMutation } = useProcessMutations(queryClient, add, setScalingProcess, setScaleInstances);
    if (isLoading) {
        return (_jsxs("div", { className: "p-6", children: [_jsx(PageHeader, {}), _jsx("p", { className: "text-muted-foreground", children: "Loading..." })] }));
    }
    if (error) {
        return (_jsxs("div", { className: "p-6", children: [_jsx(PageHeader, {}), _jsx("p", { className: "text-destructive", children: "Failed to load processes" })] }));
    }
    return (_jsxs("div", { className: "p-6", children: [_jsx(PageHeader, {}), _jsx(ProcessTable, { processes: processes, scalingProcess: scalingProcess, scaleInstances: scaleInstances, scaleMutation: scaleMutation, processMutation: processMutation, onStartEdit: (name, instances) => {
                    setScalingProcess(name);
                    setScaleInstances(String(instances));
                }, onCancelScaling: () => setScalingProcess(null) })] }));
}

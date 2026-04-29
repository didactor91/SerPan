import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/api/client';
import { useNotificationsStore } from '@/stores/notifications.store';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { Badge } from '@/components/ui/Badge';
import { SnapshotHistory } from './SnapshotHistory';
function CaddyConfigPreview({ config }) {
    const lines = [
        '{',
        '  # Proxy route for ' + config.host,
        '  @' + config.host.replace(/\./g, '_') + ' host ' + config.host,
        '  reverse_proxy @' +
            config.host.replace(/\./g, '_') +
            ' ' +
            config.upstreamHost +
            ':' +
            config.upstreamPort,
        '}',
    ];
    if (config.tls) {
        lines.push('  # TLS enabled');
        lines.push('  tls internal');
    }
    lines.push('}');
    return _jsx("pre", { className: "bg-muted p-4 rounded-md text-sm overflow-x-auto", children: lines.join('\n') });
}
function RouteTable({ routes, onEdit, onDelete }) {
    return (_jsx(Card, { children: _jsx(CardContent, { className: "p-0", children: _jsxs("table", { className: "w-full", children: [_jsx("thead", { children: _jsxs("tr", { className: "border-b bg-muted/50", children: [_jsx("th", { className: "text-left p-3 font-medium", children: "Hostname" }), _jsx("th", { className: "text-left p-3 font-medium", children: "Upstream" }), _jsx("th", { className: "text-center p-3 font-medium", children: "TLS" }), _jsx("th", { className: "text-right p-3 font-medium", children: "Actions" })] }) }), _jsx("tbody", { children: routes.length === 0 ? (_jsx("tr", { children: _jsx("td", { colSpan: 4, className: "p-6 text-center text-muted-foreground", children: "No routes configured" }) })) : (routes.map((route) => (_jsxs("tr", { className: "border-b", children: [_jsx("td", { className: "p-3 font-medium", children: route.host }), _jsx("td", { className: "p-3 text-muted-foreground", children: (route.upstreamHost ?? 'localhost') + ':' + String(route.upstreamPort) }), _jsx("td", { className: "p-3 text-center", children: _jsx(Badge, { variant: route.tls ? 'default' : 'secondary', children: route.tls ? 'Enabled' : 'Disabled' }) }), _jsx("td", { className: "p-3 text-right", children: _jsxs("div", { className: "flex items-center justify-end gap-1", children: [_jsx(Button, { size: "sm", variant: "ghost", onClick: () => onEdit(route), children: "Edit" }), _jsx(Button, { size: "sm", variant: "ghost", onClick: () => onDelete(route.id), children: "Delete" })] }) })] }, route.id)))) })] }) }) }));
}
function PageHeader() {
    return _jsx("h1", { className: "text-2xl font-bold", children: "Proxy Manager" });
}
function Toolbar({ onAddRoute, onViewSnapshots }) {
    return (_jsxs("div", { className: "flex gap-2", children: [_jsx(Button, { variant: "outline", onClick: onViewSnapshots, children: "Snapshots" }), _jsx(Button, { onClick: onAddRoute, children: "Add Route" })] }));
}
function RouteFormArea({ showAddModal, editingRoute, formData, showPreview, isPending, onFormDataChange, onShowPreviewChange, onSubmit, onCancel, }) {
    if (!showAddModal)
        return null;
    return (_jsx(RouteFormModal, { editingRoute: editingRoute, formData: formData, showPreview: showPreview, isPending: isPending, onFormDataChange: onFormDataChange, onShowPreviewChange: onShowPreviewChange, onSubmit: onSubmit, onCancel: onCancel }));
}
function useProxyManager() {
    const queryClient = useQueryClient();
    const { add } = useNotificationsStore();
    const [showSnapshots, setShowSnapshots] = useState(false);
    const [showAddModal, setShowAddModal] = useState(false);
    const [showPreview, setShowPreview] = useState(false);
    const [editingRoute, setEditingRoute] = useState(null);
    const [deleteConfirm, setDeleteConfirm] = useState(null);
    const [formData, setFormData] = useState({
        host: '',
        upstreamHost: 'localhost',
        upstreamPort: '3000',
        tls: true,
    });
    const { data, isLoading, error } = useQuery({
        queryKey: ['proxy-routes'],
        queryFn: () => apiClient.get('/proxy/routes'),
    });
    const resetForm = useCallback(() => {
        setFormData({ host: '', upstreamHost: 'localhost', upstreamPort: '3000', tls: true });
    }, []);
    const { addMutation, updateMutation, deleteMutation } = useRouteMutations({
        queryClient,
        add,
        resetForm,
        setShowAddModal,
        setEditingRoute,
        setDeleteConfirm,
    });
    const handleSubmit = useCallback(() => {
        const port = parseInt(formData.upstreamPort, 10);
        if (!formData.host || isNaN(port) || port < 1 || port > 65535) {
            add({ type: 'error', message: 'Please fill in all required fields correctly' });
            return;
        }
        const routeData = { host: formData.host, upstreamPort: port, tls: formData.tls };
        if (editingRoute) {
            updateMutation.mutate({ id: editingRoute.id, ...routeData });
        }
        else {
            addMutation.mutate(routeData);
        }
    }, [formData, editingRoute, addMutation, updateMutation, add]);
    const startEdit = useCallback((route) => {
        setEditingRoute(route);
        setFormData({
            host: route.host,
            upstreamHost: route.upstreamHost ?? 'localhost',
            upstreamPort: String(route.upstreamPort),
            tls: route.tls,
        });
        setShowAddModal(true);
    }, []);
    return {
        showSnapshots,
        setShowSnapshots,
        isLoading,
        error: error ?? null,
        routes: data?.data.routes ?? [],
        showAddModal,
        setShowAddModal,
        showPreview,
        setShowPreview,
        editingRoute,
        setEditingRoute,
        deleteConfirm,
        setDeleteConfirm,
        formData,
        setFormData,
        isFormPending: addMutation.isPending || updateMutation.isPending,
        isDeletePending: deleteMutation.isPending,
        deleteMutation,
        handleSubmit,
        startEdit,
        resetForm,
    };
}
function useRouteMutations(callbacks) {
    const { queryClient, add, resetForm, setShowAddModal, setEditingRoute, setDeleteConfirm } = callbacks;
    const addMutation = useMutation({
        mutationFn: (route) => {
            return apiClient.post('/proxy/routes', route);
        },
        onSuccess: () => {
            void queryClient.invalidateQueries({ queryKey: ['proxy-routes'] });
            setShowAddModal(false);
            resetForm();
            add({ type: 'success', message: 'Route added successfully' });
        },
        onError: (err) => {
            add({ type: 'error', message: err.message || 'Failed to add route' });
        },
    });
    const updateMutation = useMutation({
        mutationFn: ({ id, ...route }) => {
            return apiClient.put(`/proxy/routes/${id}`, route);
        },
        onSuccess: () => {
            void queryClient.invalidateQueries({ queryKey: ['proxy-routes'] });
            setEditingRoute(null);
            resetForm();
            add({ type: 'success', message: 'Route updated successfully' });
        },
        onError: (err) => {
            add({ type: 'error', message: err.message || 'Failed to update route' });
        },
    });
    const deleteMutation = useMutation({
        mutationFn: (id) => apiClient.delete(`/proxy/routes/${id}`),
        onSuccess: () => {
            void queryClient.invalidateQueries({ queryKey: ['proxy-routes'] });
            setDeleteConfirm(null);
            add({ type: 'success', message: 'Route deleted successfully' });
        },
        onError: (err) => {
            add({ type: 'error', message: err.message || 'Failed to delete route' });
        },
    });
    return { addMutation, updateMutation, deleteMutation };
}
function RouteFormModal({ editingRoute, formData, showPreview, isPending, onFormDataChange, onShowPreviewChange, onSubmit, onCancel, }) {
    return (_jsx("div", { className: "fixed inset-0 bg-black/50 flex items-center justify-center z-50", children: _jsxs("div", { className: "bg-background rounded-lg p-6 w-full max-w-md shadow-xl", children: [_jsx("h2", { className: "text-lg font-semibold mb-4", children: editingRoute ? 'Edit Route' : 'Add Route' }), _jsxs("div", { className: "space-y-4", children: [_jsxs("div", { children: [_jsx(Label, { htmlFor: "host", required: true, children: "Hostname" }), _jsx(Input, { id: "host", value: formData.host, onChange: (e) => onFormDataChange({ ...formData, host: e.target.value }), placeholder: "example.com" })] }), _jsxs("div", { className: "grid grid-cols-2 gap-4", children: [_jsxs("div", { children: [_jsx(Label, { htmlFor: "upstreamHost", children: "Upstream Host" }), _jsx(Input, { id: "upstreamHost", value: formData.upstreamHost, onChange: (e) => onFormDataChange({ ...formData, upstreamHost: e.target.value }), placeholder: "localhost" })] }), _jsxs("div", { children: [_jsx(Label, { htmlFor: "upstreamPort", required: true, children: "Port" }), _jsx(Input, { id: "upstreamPort", type: "number", min: "1", max: "65535", value: formData.upstreamPort, onChange: (e) => onFormDataChange({ ...formData, upstreamPort: e.target.value }), placeholder: "3000" })] })] }), _jsxs("div", { className: "flex items-center gap-2", children: [_jsx("input", { type: "checkbox", id: "tls", checked: formData.tls, onChange: (e) => onFormDataChange({ ...formData, tls: e.target.checked }), className: "h-4 w-4" }), _jsx(Label, { htmlFor: "tls", className: "cursor-pointer", children: "Enable TLS" })] }), _jsx("button", { type: "button", onClick: () => onShowPreviewChange(!showPreview), className: "text-sm text-muted-foreground hover:text-foreground", children: showPreview ? 'Hide Preview' : 'Show Preview' }), showPreview && _jsx(CaddyConfigPreview, { config: formData })] }), _jsxs("div", { className: "flex justify-end gap-2 mt-6", children: [_jsx(Button, { variant: "outline", onClick: onCancel, children: "Cancel" }), _jsx(Button, { onClick: onSubmit, disabled: isPending, children: editingRoute ? 'Update' : 'Add' })] })] }) }));
}
function DeleteConfirmModal({ routeId, isPending, onConfirm, onCancel }) {
    if (!routeId)
        return null;
    return (_jsx("div", { className: "fixed inset-0 bg-black/50 flex items-center justify-center z-50", children: _jsxs("div", { className: "bg-background rounded-lg p-6 w-full max-w-sm shadow-xl", children: [_jsx("h2", { className: "text-lg font-semibold mb-4", children: "Confirm Delete" }), _jsx("p", { className: "text-muted-foreground mb-6", children: "Are you sure you want to delete this route? This action cannot be undone." }), _jsxs("div", { className: "flex justify-end gap-2", children: [_jsx(Button, { variant: "outline", onClick: onCancel, children: "Cancel" }), _jsx(Button, { variant: "destructive", onClick: () => onConfirm(routeId), disabled: isPending, children: "Delete" })] })] }) }));
}
export function ProxyManagerPage() {
    const { showSnapshots, setShowSnapshots, isLoading, error, routes, showAddModal, setShowAddModal, showPreview, setShowPreview, editingRoute, setEditingRoute, deleteConfirm, setDeleteConfirm, formData, setFormData, isFormPending, isDeletePending, deleteMutation, handleSubmit, startEdit, resetForm, } = useProxyManager();
    if (showSnapshots) {
        return _jsx(SnapshotHistory, { onBack: () => setShowSnapshots(false) });
    }
    if (isLoading) {
        return (_jsxs("div", { className: "p-6", children: [_jsx(PageHeader, {}), _jsx("p", { className: "text-muted-foreground", children: "Loading..." })] }));
    }
    if (error) {
        return (_jsxs("div", { className: "p-6", children: [_jsx(PageHeader, {}), _jsx("p", { className: "text-destructive", children: "Failed to load routes" })] }));
    }
    return (_jsxs("div", { className: "p-6", children: [_jsxs("div", { className: "flex items-center justify-between mb-6", children: [_jsx(PageHeader, {}), _jsx(Toolbar, { onAddRoute: () => {
                            resetForm();
                            setShowAddModal(true);
                        }, onViewSnapshots: () => setShowSnapshots(true) })] }), _jsx(RouteTable, { routes: routes, onEdit: startEdit, onDelete: setDeleteConfirm }), _jsx(RouteFormArea, { showAddModal: showAddModal, editingRoute: editingRoute, formData: formData, showPreview: showPreview, isPending: isFormPending, onFormDataChange: setFormData, onShowPreviewChange: setShowPreview, onSubmit: handleSubmit, onCancel: () => {
                    setShowAddModal(false);
                    setEditingRoute(null);
                    resetForm();
                } }), _jsx(DeleteConfirmModal, { routeId: deleteConfirm, isPending: isDeletePending, onConfirm: (id) => deleteMutation.mutate(id), onCancel: () => setDeleteConfirm(null) })] }));
}

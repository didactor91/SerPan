import { jsxs as _jsxs, jsx as _jsx } from "react/jsx-runtime";
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/api/client';
import { useNotificationsStore } from '@/stores/notifications.store';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';
import { format } from 'date-fns';
function simpleDiff(text1, text2) {
    const lines1 = text1.split('\n');
    const lines2 = text2.split('\n');
    const result = [];
    const maxLen = Math.max(lines1.length, lines2.length);
    for (let i = 0; i < maxLen; i++) {
        const l1 = lines1[i];
        const l2 = lines2[i] ?? '';
        if (l1 === undefined) {
            result.push({ type: 'added', content: l2 });
        }
        else if (l1 !== l2) {
            result.push({ type: 'removed', content: l1 });
            result.push({ type: 'added', content: l2 });
        }
        else {
            result.push({ type: 'unchanged', content: l1 });
        }
    }
    return result;
}
function DiffView({ oldText, newText }) {
    const diffLines = simpleDiff(oldText, newText);
    return (_jsx("div", { className: "bg-muted rounded-md p-4 overflow-x-auto text-sm font-mono", children: diffLines.map((line, index) => (_jsxs("div", { className: line.type === 'added'
                ? 'bg-green-900/30 text-green-400'
                : line.type === 'removed'
                    ? 'bg-red-900/30 text-red-400'
                    : 'text-muted-foreground', children: [line.type === 'added' ? '+ ' : line.type === 'removed' ? '- ' : '  ', line.content] }, index))) }));
}
function SnapshotCard({ snapshot, onViewDiff, onRollback }) {
    return (_jsx(Card, { children: _jsx(CardContent, { className: "p-4", children: _jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("div", { children: [_jsx("p", { className: "font-medium", children: snapshot.description }), _jsx("p", { className: "text-sm text-muted-foreground", children: format(new Date(snapshot.createdAt), 'PPpp') })] }), _jsxs("div", { className: "flex gap-2", children: [_jsx(Button, { size: "sm", variant: "outline", onClick: () => onViewDiff(snapshot), children: "View Diff" }), _jsx(Button, { size: "sm", variant: "destructive", onClick: () => onRollback(snapshot.id), children: "Rollback" })] })] }) }) }));
}
function DiffModal({ snapshot, currentConfig, onClose }) {
    if (!snapshot)
        return null;
    return (_jsx("div", { className: "fixed inset-0 bg-black/50 flex items-center justify-center z-50", children: _jsxs("div", { className: "bg-background rounded-lg p-6 w-full max-w-3xl shadow-xl max-h-[80vh] overflow-auto", children: [_jsxs("h2", { className: "text-lg font-semibold mb-4", children: ["Diff: ", snapshot.description] }), _jsx("p", { className: "text-sm text-muted-foreground mb-4", children: "Comparing snapshot (left) vs current config (right)" }), _jsx(DiffView, { oldText: snapshot.configSnapshot, newText: currentConfig }), _jsx("div", { className: "flex justify-end mt-4", children: _jsx(Button, { onClick: onClose, children: "Close" }) })] }) }));
}
function RollbackConfirmModal({ snapshotId, isPending, onConfirm, onCancel, }) {
    if (!snapshotId)
        return null;
    return (_jsx("div", { className: "fixed inset-0 bg-black/50 flex items-center justify-center z-50", children: _jsxs("div", { className: "bg-background rounded-lg p-6 w-full max-w-sm shadow-xl", children: [_jsx("h2", { className: "text-lg font-semibold mb-4", children: "Confirm Rollback" }), _jsx("p", { className: "text-muted-foreground mb-6", children: "This will restore the proxy configuration to the selected snapshot. A new snapshot will be created before making changes." }), _jsxs("div", { className: "flex justify-end gap-2", children: [_jsx(Button, { variant: "outline", onClick: onCancel, children: "Cancel" }), _jsx(Button, { variant: "destructive", onClick: () => onConfirm(snapshotId), disabled: isPending, children: "Rollback" })] })] }) }));
}
export function SnapshotHistory({ onBack }) {
    const queryClient = useQueryClient();
    const { add } = useNotificationsStore();
    const [selectedSnapshot, setSelectedSnapshot] = useState(null);
    const [showDiff, setShowDiff] = useState(false);
    const [rollbackConfirm, setRollbackConfirm] = useState(null);
    const { data, isLoading, error } = useQuery({
        queryKey: ['proxy-snapshots'],
        queryFn: () => apiClient.get('/proxy/snapshots'),
    });
    const rollbackMutation = useMutation({
        mutationFn: (id) => apiClient.post(`/proxy/rollback/${id}`),
        onSuccess: () => {
            void queryClient.invalidateQueries({ queryKey: ['proxy-routes'] });
            setRollbackConfirm(null);
            add({ type: 'success', message: 'Rollback completed successfully' });
            onBack();
        },
        onError: (err) => {
            add({ type: 'error', message: err.message || 'Failed to rollback' });
        },
    });
    const snapshots = data?.data.snapshots ?? [];
    const currentConfig = JSON.stringify(snapshots[0], null, 2);
    if (isLoading) {
        return (_jsxs("div", { className: "p-6", children: [_jsx("h1", { className: "text-2xl font-bold mb-6", children: "Snapshot History" }), _jsx("p", { className: "text-muted-foreground", children: "Loading..." })] }));
    }
    if (error) {
        return (_jsxs("div", { className: "p-6", children: [_jsx("h1", { className: "text-2xl font-bold mb-6", children: "Snapshot History" }), _jsx("p", { className: "text-destructive", children: "Failed to load snapshots" })] }));
    }
    return (_jsxs("div", { className: "p-6", children: [_jsxs("div", { className: "flex items-center justify-between mb-6", children: [_jsx("h1", { className: "text-2xl font-bold", children: "Snapshot History" }), _jsx(Button, { variant: "outline", onClick: onBack, children: "Back to Routes" })] }), snapshots.length === 0 ? (_jsx(Card, { children: _jsx(CardContent, { className: "p-6", children: _jsx("p", { className: "text-muted-foreground text-center", children: "No snapshots available" }) }) })) : (_jsx("div", { className: "space-y-4", children: snapshots.map((snapshot) => (_jsx(SnapshotCard, { snapshot: snapshot, onViewDiff: (s) => {
                        setSelectedSnapshot(s);
                        setShowDiff(true);
                    }, onRollback: (id) => setRollbackConfirm(id) }, snapshot.id))) })), _jsx(DiffModal, { snapshot: showDiff ? selectedSnapshot : null, currentConfig: currentConfig, onClose: () => setShowDiff(false) }), _jsx(RollbackConfirmModal, { snapshotId: rollbackConfirm, isPending: rollbackMutation.isPending, onConfirm: (id) => rollbackMutation.mutate(id), onCancel: () => setRollbackConfirm(null) })] }));
}

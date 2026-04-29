import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/api/client';
import { LogViewer } from '@/components/shared/LogViewer';
import { useLogStream } from '@/hooks/useLogStream';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';
function LogViewerCard({ lines, isPaused, selectedProcess }) {
    return (_jsx(Card, { className: "flex-1", children: _jsx(CardContent, { className: "p-0 h-full", children: selectedProcess ? (_jsx("div", { className: "h-full", children: _jsx(LogViewer, { lines: lines, autoScroll: !isPaused }) })) : (_jsx("div", { className: "flex items-center justify-center h-full text-muted-foreground", children: "Select a process to view logs" })) }) }));
}
function LogControls({ processes, selectedProcess, logLevel, searchFilter, isPaused, filteredLogsLength, onProcessChange, onLevelChange, onSearchChange, onTogglePause, onClear, onDownload, }) {
    return (_jsx(Card, { className: "mb-4", children: _jsx(CardContent, { className: "p-4", children: _jsxs("div", { className: "flex flex-wrap gap-4 items-end", children: [_jsxs("div", { className: "flex flex-col gap-1", children: [_jsx("label", { className: "text-sm font-medium", children: "Process" }), _jsxs("select", { value: selectedProcess, onChange: onProcessChange, className: "h-10 px-3 rounded-md border border-input bg-background text-sm", children: [_jsx("option", { value: "", children: "Select a process" }), processes.map((proc) => (_jsx("option", { value: proc.name, children: proc.name }, proc.name)))] })] }), _jsxs("div", { className: "flex flex-col gap-1", children: [_jsx("label", { className: "text-sm font-medium", children: "Log Level" }), _jsxs("select", { value: logLevel, onChange: onLevelChange, className: "h-10 px-3 rounded-md border border-input bg-background text-sm", children: [_jsx("option", { value: "all", children: "All" }), _jsx("option", { value: "info", children: "Info" }), _jsx("option", { value: "warn", children: "Warning" }), _jsx("option", { value: "error", children: "Error" })] })] }), _jsxs("div", { className: "flex flex-col gap-1 flex-1", children: [_jsx("label", { className: "text-sm font-medium", children: "Search" }), _jsx("input", { type: "text", value: searchFilter, onChange: (e) => onSearchChange(e.target.value), placeholder: "Filter logs...", className: "h-10 px-3 rounded-md border border-input bg-background text-sm" })] }), _jsxs("div", { className: "flex gap-2", children: [_jsx(Button, { variant: "outline", size: "sm", onClick: onTogglePause, disabled: !selectedProcess, children: isPaused ? 'Resume' : 'Pause' }), _jsx(Button, { variant: "outline", size: "sm", onClick: onClear, disabled: !selectedProcess, children: "Clear" }), _jsx(Button, { variant: "outline", size: "sm", onClick: onDownload, disabled: filteredLogsLength === 0, children: "Download" })] })] }) }) }));
}
export function LogViewerPage() {
    const [selectedProcess, setSelectedProcess] = useState('');
    const [logLevel, setLogLevel] = useState('all');
    const [searchFilter, setSearchFilter] = useState('');
    const [isPaused, setIsPaused] = useState(false);
    const { data: processesData } = useQuery({
        queryKey: ['processes'],
        queryFn: () => apiClient.get('/processes'),
    });
    const processes = processesData?.data.processes ?? [];
    const { logs, isStreaming, pause, resume, clear } = useLogStream({
        processName: selectedProcess,
        level: logLevel === 'all' ? undefined : logLevel,
        enabled: selectedProcess !== '' && !isPaused,
    });
    const filteredLogs = searchFilter
        ? logs.filter((log) => log.toLowerCase().includes(searchFilter.toLowerCase()))
        : logs;
    const handleProcessChange = useCallback((e) => {
        setSelectedProcess(e.target.value);
    }, []);
    const handleLevelChange = useCallback((e) => {
        setLogLevel(e.target.value);
    }, []);
    const handleTogglePause = useCallback(() => {
        if (isPaused) {
            resume();
        }
        else {
            pause();
        }
        setIsPaused(!isPaused);
    }, [isPaused, pause, resume]);
    const handleClear = useCallback(() => {
        clear();
    }, [clear]);
    const handleDownload = useCallback(() => {
        const content = filteredLogs.join('\n');
        const blob = new Blob([content], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = (selectedProcess || 'logs') + '-' + new Date().toISOString() + '.log';
        a.click();
        URL.revokeObjectURL(url);
    }, [filteredLogs, selectedProcess]);
    return (_jsxs("div", { className: "p-6 h-full flex flex-col", children: [_jsxs("div", { className: "flex items-center justify-between mb-6", children: [_jsx("h1", { className: "text-2xl font-bold", children: "Log Viewer" }), _jsx("div", { className: "flex gap-2 items-center", children: _jsx("span", { className: "text-sm text-muted-foreground", children: isStreaming ? (_jsx("span", { className: "text-green-500", children: "\u25CF Streaming" })) : (_jsx("span", { className: "text-muted-foreground", children: "\u25CB Idle" })) }) })] }), _jsx(LogControls, { processes: processes, selectedProcess: selectedProcess, logLevel: logLevel, searchFilter: searchFilter, isPaused: isPaused, filteredLogsLength: filteredLogs.length, onProcessChange: handleProcessChange, onLevelChange: handleLevelChange, onSearchChange: setSearchFilter, onTogglePause: handleTogglePause, onClear: handleClear, onDownload: handleDownload }), _jsx(LogViewerCard, { lines: filteredLogs, isPaused: isPaused, selectedProcess: selectedProcess })] }));
}

import { useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/api/client';
import { LogViewer } from '@/components/shared/LogViewer';
import { useLogStream } from '@/hooks/useLogStream';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';

interface PM2Process {
  name: string;
  status: string;
  pid: number;
  cpu: number;
  memory: number;
  instances: number;
  uptime: number;
}

interface ProcessListResponse {
  data: {
    processes: PM2Process[];
  };
}

type LogLevel = 'all' | 'info' | 'warn' | 'error';

export function LogViewerPage() {
  const [selectedProcess, setSelectedProcess] = useState<string>('');
  const [logLevel, setLogLevel] = useState<LogLevel>('all');
  const [searchFilter, setSearchFilter] = useState('');
  const [isPaused, setIsPaused] = useState(false);

  const { data: processesData } = useQuery<ProcessListResponse>({
    queryKey: ['processes'],
    queryFn: () => apiClient.get('/processes'),
  });

  const processes = processesData?.data?.processes ?? [];

  const { logs, isStreaming, pause, resume, clear } = useLogStream({
    processName: selectedProcess,
    level: logLevel === 'all' ? undefined : logLevel,
    enabled: !!selectedProcess && !isPaused,
  });

  const filteredLogs = searchFilter
    ? logs.filter((log) => log.toLowerCase().includes(searchFilter.toLowerCase()))
    : logs;

  const handleProcessChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedProcess(e.target.value);
  }, []);

  const handleLevelChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    setLogLevel(e.target.value as LogLevel);
  }, []);

  const handleTogglePause = useCallback(() => {
    if (isPaused) {
      resume();
    } else {
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
    a.download = `${selectedProcess || 'logs'}-${new Date().toISOString()}.log`;
    a.click();
    URL.revokeObjectURL(url);
  }, [filteredLogs, selectedProcess]);

  return (
    <div className="p-6 h-full flex flex-col">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Log Viewer</h1>
        <div className="flex gap-2 items-center">
          <span className="text-sm text-muted-foreground">
            {isStreaming ? (
              <span className="text-green-500">● Streaming</span>
            ) : (
              <span className="text-muted-foreground">○ Idle</span>
            )}
          </span>
        </div>
      </div>

      {/* Controls */}
      <Card className="mb-4">
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-4 items-end">
            {/* Process Selector */}
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium">Process</label>
              <select
                value={selectedProcess}
                onChange={handleProcessChange}
                className="h-10 px-3 rounded-md border border-input bg-background text-sm"
              >
                <option value="">Select a process</option>
                {processes.map((proc) => (
                  <option key={proc.name} value={proc.name}>
                    {proc.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Log Level Filter */}
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium">Log Level</label>
              <select
                value={logLevel}
                onChange={handleLevelChange}
                className="h-10 px-3 rounded-md border border-input bg-background text-sm"
              >
                <option value="all">All</option>
                <option value="info">Info</option>
                <option value="warn">Warning</option>
                <option value="error">Error</option>
              </select>
            </div>

            {/* Search */}
            <div className="flex flex-col gap-1 flex-1">
              <label className="text-sm font-medium">Search</label>
              <input
                type="text"
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                placeholder="Filter logs..."
                className="h-10 px-3 rounded-md border border-input bg-background text-sm"
              />
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleTogglePause}
                disabled={!selectedProcess}
              >
                {isPaused ? 'Resume' : 'Pause'}
              </Button>
              <Button variant="outline" size="sm" onClick={handleClear} disabled={!selectedProcess}>
                Clear
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleDownload}
                disabled={filteredLogs.length === 0}
              >
                Download
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Log Viewer */}
      <Card className="flex-1">
        <CardContent className="p-0 h-full">
          {selectedProcess ? (
            <div className="h-full">
              <LogViewer lines={filteredLogs} autoScroll={!isPaused} />
            </div>
          ) : (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              Select a process to view logs
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

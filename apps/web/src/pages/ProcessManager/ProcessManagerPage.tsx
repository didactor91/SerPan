import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/api/client';
import type { PM2Process } from '@serverctrl/shared';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';
import { useNotificationsStore } from '@/stores/notifications.store';
import { useWebSocket } from '@/hooks/useWebSocket';

function formatUptime(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ${hours % 24}h`;
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  return `${minutes}m`;
}

function formatMemory(bytes: number): string {
  const mb = bytes / (1024 * 1024);
  return `${mb.toFixed(0)}MB`;
}

export function ProcessManagerPage() {
  const queryClient = useQueryClient();
  const { add } = useNotificationsStore();
  const [scalingProcess, setScalingProcess] = useState<string | null>(null);
  const [scaleInstances, setScaleInstances] = useState('');

  const handleProcessStatusChange = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['processes'] });
  }, [queryClient]);

  // Subscribe to process status changes via WebSocket
  useWebSocket({ onProcessStatusChange: handleProcessStatusChange });

  const { data, isLoading, error } = useQuery<{ data: { processes: PM2Process[] } }>({
    queryKey: ['processes'],
    queryFn: () => apiClient.get('/processes'),
    refetchInterval: 5000,
  });

  const processes = data?.data?.processes ?? [];

  const processMutation = useMutation({
    mutationFn: ({ name, action }: { name: string; action: string }) => {
      return apiClient.post(`/processes/${name}/${action}`);
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['processes'] });
      add({ type: 'success', message: `Process ${variables.name} ${variables.action}d` });
    },
    onError: (error, variables) => {
      add({
        type: 'error',
        message: `Failed to ${variables.action} ${variables.name}: ${error instanceof Error ? error.message : 'Unknown error'}`,
      });
    },
  });

  const scaleMutation = useMutation({
    mutationFn: ({ name, instances }: { name: string; instances: number }) => {
      return apiClient.post(`/processes/${name}/scale`, { instances });
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['processes'] });
      setScalingProcess(null);
      setScaleInstances('');
      add({
        type: 'success',
        message: `Process ${variables.name} scaled to ${variables.instances}`,
      });
    },
    onError: (error, variables) => {
      add({
        type: 'error',
        message: `Failed to scale ${variables.name}: ${error instanceof Error ? error.message : 'Unknown error'}`,
      });
    },
  });

  if (isLoading) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold mb-6">Process Manager</h1>
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold mb-6">Process Manager</h1>
        <p className="text-destructive">Failed to load processes</p>
      </div>
    );
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Process Manager</h1>

      <Card>
        <CardContent className="p-0">
          <table className="w-full">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left p-3 font-medium">Name</th>
                <th className="text-left p-3 font-medium">Status</th>
                <th className="text-right p-3 font-medium">PID</th>
                <th className="text-right p-3 font-medium">CPU</th>
                <th className="text-right p-3 font-medium">RAM</th>
                <th className="text-right p-3 font-medium">Workers</th>
                <th className="text-right p-3 font-medium">Uptime</th>
                <th className="text-right p-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {processes.map((proc) => (
                <tr key={proc.name} className="border-b">
                  <td className="p-3 font-medium">{proc.name}</td>
                  <td className="p-3">
                    <StatusBadge status={proc.status} />
                  </td>
                  <td className="p-3 text-right text-muted-foreground">{proc.pid}</td>
                  <td className="p-3 text-right">{proc.cpu.toFixed(1)}%</td>
                  <td className="p-3 text-right">{formatMemory(proc.memory)}</td>
                  <td className="p-3 text-right">
                    {scalingProcess === proc.name ? (
                      <div className="flex items-center justify-end gap-1">
                        <input
                          type="number"
                          min="1"
                          value={scaleInstances}
                          onChange={(e) => setScaleInstances(e.target.value)}
                          className="w-16 h-7 text-sm border rounded px-1"
                        />
                        <Button
                          size="sm"
                          onClick={() =>
                            scaleMutation.mutate({
                              name: proc.name,
                              instances: parseInt(scaleInstances) || 1,
                            })
                          }
                          disabled={scaleMutation.isPending}
                        >
                          ✓
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setScalingProcess(null)}>
                          ✕
                        </Button>
                      </div>
                    ) : (
                      <span
                        className="cursor-pointer hover:text-primary"
                        onClick={() => {
                          setScalingProcess(proc.name);
                          setScaleInstances(String(proc.instances));
                        }}
                      >
                        {proc.instances}
                      </span>
                    )}
                  </td>
                  <td className="p-3 text-right text-muted-foreground">
                    {formatUptime(proc.uptime)}
                  </td>
                  <td className="p-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => processMutation.mutate({ name: proc.name, action: 'start' })}
                        disabled={proc.status === 'online' || processMutation.isPending}
                        title="Start"
                      >
                        ▶
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => processMutation.mutate({ name: proc.name, action: 'stop' })}
                        disabled={proc.status === 'stopped' || processMutation.isPending}
                        title="Stop"
                      >
                        ■
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          processMutation.mutate({ name: proc.name, action: 'restart' })
                        }
                        disabled={processMutation.isPending}
                        title="Restart"
                      >
                        ↺
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}

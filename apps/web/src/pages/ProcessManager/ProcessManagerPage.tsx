import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/api/client';
import type { PM2Process } from '@serverctrl/shared';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';
import { useNotificationsStore, Notification } from '@/stores/notifications.store';
import { useWebSocket } from '@/hooks/useWebSocket';

function formatUptime(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return String(days) + 'd ' + String(hours % 24) + 'h';
  if (hours > 0) return String(hours) + 'h ' + String(minutes % 60) + 'm';
  return String(minutes) + 'm';
}

function formatMemory(bytes: number): string {
  const mb = bytes / (1024 * 1024);
  return mb.toFixed(0) + 'MB';
}

interface ProcessRowProps {
  proc: PM2Process;
  scalingProcess: string | null;
  scaleInstances: string;
  isScalingPending: boolean;
  onStartScaling: (name: string, instances: number) => void;
  onCancelScaling: () => void;
  onStartEdit: (name: string, instances: number) => void;
  onAction: (name: string, action: string) => void;
  isActionPending: boolean;
}

function ProcessRow({
  proc,
  scalingProcess,
  scaleInstances,
  isScalingPending,
  onStartScaling,
  onCancelScaling,
  onStartEdit,
  onAction,
  isActionPending,
}: ProcessRowProps) {
  const isScaling = scalingProcess === proc.name;

  return (
    <tr key={proc.name} className="border-b">
      <td className="p-3 font-medium">{proc.name}</td>
      <td className="p-3">
        <StatusBadge status={proc.status} />
      </td>
      <td className="p-3 text-right text-muted-foreground">{proc.pid}</td>
      <td className="p-3 text-right">{proc.cpu.toFixed(1)}%</td>
      <td className="p-3 text-right">{formatMemory(proc.memory)}</td>
      <td className="p-3 text-right">
        {isScaling ? (
          <div className="flex items-center justify-end gap-1">
            <input
              type="number"
              min="1"
              value={scaleInstances}
              onChange={(e) => onStartScaling(proc.name, parseInt(e.target.value) || 1)}
              className="w-16 h-7 text-sm border rounded px-1"
            />
            <Button
              size="sm"
              onClick={() => onStartScaling(proc.name, parseInt(scaleInstances) || 1)}
              disabled={isScalingPending}
            >
              ✓
            </Button>
            <Button size="sm" variant="ghost" onClick={onCancelScaling}>
              ✕
            </Button>
          </div>
        ) : (
          <span
            className="cursor-pointer hover:text-primary"
            onClick={() => onStartEdit(proc.name, proc.instances)}
          >
            {proc.instances}
          </span>
        )}
      </td>
      <td className="p-3 text-right text-muted-foreground">{formatUptime(proc.uptime)}</td>
      <td className="p-3 text-right">
        <div className="flex items-center justify-end gap-1">
          <Button
            size="sm"
            variant="outline"
            onClick={() => onAction(proc.name, 'start')}
            disabled={proc.status === 'online' || isActionPending}
            title="Start"
          >
            ▶
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => onAction(proc.name, 'stop')}
            disabled={proc.status === 'stopped' || isActionPending}
            title="Stop"
          >
            ■
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => onAction(proc.name, 'restart')}
            disabled={isActionPending}
            title="Restart"
          >
            ↺
          </Button>
        </div>
      </td>
    </tr>
  );
}

function ProcessTable({
  processes,
  scalingProcess,
  scaleInstances,
  scaleMutation,
  processMutation,
  onStartEdit,
  onCancelScaling,
}: {
  processes: PM2Process[];
  scalingProcess: string | null;
  scaleInstances: string;
  scaleMutation: {
    isPending: boolean;
    mutate: (vars: { name: string; instances: number }) => void;
  };
  processMutation: { isPending: boolean; mutate: (vars: { name: string; action: string }) => void };
  onStartEdit: (name: string, instances: number) => void;
  onCancelScaling: () => void;
}) {
  return (
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
              <ProcessRow
                key={proc.name}
                proc={proc}
                scalingProcess={scalingProcess}
                scaleInstances={scaleInstances}
                isScalingPending={scaleMutation.isPending}
                onStartScaling={(name, instances) => scaleMutation.mutate({ name, instances })}
                onCancelScaling={onCancelScaling}
                onStartEdit={onStartEdit}
                onAction={(name, action) => processMutation.mutate({ name, action })}
                isActionPending={processMutation.isPending}
              />
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}

function PageHeader() {
  return <h1 className="text-2xl font-bold mb-6">Process Manager</h1>;
}

function useProcessMutations(
  queryClient: ReturnType<typeof useQueryClient>,
  add: (notification: Omit<Notification, 'id'>) => void,
  setScalingProcess: (value: null) => void,
  setScaleInstances: (value: string) => void,
) {
  const processMutation = useMutation({
    mutationFn: ({ name, action }: { name: string; action: string }) => {
      return apiClient.post<unknown>(`/processes/${name}/${action}`);
    },
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: ['processes'] });
      add({ type: 'success', message: 'Process ' + variables.name + ' ' + variables.action + 'd' });
    },
    onError: (error, variables) => {
      add({
        type: 'error',
        message:
          'Failed to ' +
          variables.action +
          ' ' +
          variables.name +
          ': ' +
          (error instanceof Error ? error.message : 'Unknown error'),
      });
    },
  });

  const scaleMutation = useMutation({
    mutationFn: ({ name, instances }: { name: string; instances: number }) => {
      return apiClient.post<unknown>(`/processes/${name}/scale`, { instances });
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
        message:
          'Failed to scale ' +
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
  const [scalingProcess, setScalingProcess] = useState<string | null>(null);
  const [scaleInstances, setScaleInstances] = useState('');

  const handleProcessStatusChange = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ['processes'] });
  }, [queryClient]);

  useWebSocket({ onProcessStatusChange: handleProcessStatusChange });

  const { data, isLoading, error } = useQuery<{ data: { processes: PM2Process[] } }>({
    queryKey: ['processes'],
    queryFn: () => apiClient.get('/processes'),
    refetchInterval: 5000,
  });

  const processes = data?.data.processes ?? [];
  const { processMutation, scaleMutation } = useProcessMutations(
    queryClient,
    add,
    setScalingProcess,
    setScaleInstances,
  );

  if (isLoading) {
    return (
      <div className="p-6">
        <PageHeader />
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <PageHeader />
        <p className="text-destructive">Failed to load processes</p>
      </div>
    );
  }

  return (
    <div className="p-6">
      <PageHeader />

      <ProcessTable
        processes={processes}
        scalingProcess={scalingProcess}
        scaleInstances={scaleInstances}
        scaleMutation={scaleMutation}
        processMutation={processMutation}
        onStartEdit={(name, instances) => {
          setScalingProcess(name);
          setScaleInstances(String(instances));
        }}
        onCancelScaling={() => setScalingProcess(null)}
      />
    </div>
  );
}

import { useState } from 'react';
import { useParams } from '@tanstack/react-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/api/client';
import type { Project, ProjectInstance } from '@serverctrl/shared';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Input } from '@/components/ui/Input';

interface ProjectResponse {
  data: Project & { instances: ProjectInstance[] };
}

interface HealthResponse {
  data: {
    status: string;
    responseTime?: number;
  };
}

interface ContainerInfo {
  id: string;
  name: string;
  image: string;
  status: string;
  state: string;
  cpuPercent: number;
  memoryPercent: number;
  memoryUsage: string;
}

interface MetricsResponse {
  data: {
    processes: Array<{
      name: string;
      status: string;
      pid: number;
      cpu: number;
      memory: number;
      instances: number;
      uptime: number;
    }>;
    containers: ContainerInfo[];
  };
}

interface LogsResponse {
  data: {
    logs: string[];
  };
}

interface ContainerLogsResponse {
  data: {
    logs: string[];
  };
}

export function ProjectDetailPage() {
  const { slug } = useParams({ from: '/projects/$slug' });
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);
  const [editedDomain, setEditedDomain] = useState('');
  const [editedPort, setEditedPort] = useState('');
  const [selectedContainerLogs, setSelectedContainerLogs] = useState<string | null>(null);

  const { data, isLoading, error } = useQuery<ProjectResponse>({
    queryKey: ['project', slug],
    queryFn: () => apiClient.get<ProjectResponse>(`/projects/${slug}`),
    enabled: !!slug,
  });

  const { data: metricsData, refetch: refetchMetrics } = useQuery<MetricsResponse>({
    queryKey: ['project-metrics', slug],
    queryFn: () => apiClient.get<MetricsResponse>(`/projects/${slug}/metrics`),
    enabled: !!slug,
    refetchInterval: 10000,
  });

  const { data: logsData } = useQuery<LogsResponse>({
    queryKey: ['project-logs', slug],
    queryFn: () => apiClient.get<LogsResponse>(`/projects/${slug}/logs`),
    enabled: !!slug,
  });

  const { data: containerLogsData, refetch: refetchContainerLogs } =
    useQuery<ContainerLogsResponse>({
      queryKey: ['container-logs', selectedContainerLogs],
      queryFn: () =>
        apiClient.get<ContainerLogsResponse>(
          `/projects/${slug}/containers/${selectedContainerLogs}/logs`,
        ),
      enabled: !!slug && !!selectedContainerLogs,
    });

  const healthMutation = useMutation<HealthResponse>({
    mutationFn: () => apiClient.get<HealthResponse>(`/projects/${slug}/health`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['project', slug] }),
  });

  const updateProjectMutation = useMutation({
    mutationFn: (updates: { domain?: string; healthCheckPort?: number }) =>
      apiClient.put(`/projects/${slug}`, updates),
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
    mutationFn: ({ name, action }: { name: string; action: 'start' | 'stop' | 'restart' }) =>
      apiClient.post(`/projects/${slug}/containers/${name}/${action}`, {}),
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

  if (isLoading) return <div>Loading...</div>;
  if (error || !data?.data) return <div>Project not found</div>;

  const project = data.data;
  const instances = project.instances || [];
  const processes = metricsData?.data?.processes ?? [];
  const containers = metricsData?.data?.containers ?? [];

  const getStatusColor = (status: string) => {
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

  const formatMemory = (bytes: number) => {
    if (!bytes) return '-';
    const mb = bytes / (1024 * 1024);
    return mb.toFixed(0) + 'MB';
  };

  const handleStartEdit = () => {
    setEditedDomain(project.domain || '');
    setEditedPort(project.healthCheckPort?.toString() || '');
    setIsEditing(true);
  };

  const handleSaveEdit = () => {
    const updates: { domain?: string; healthCheckPort?: number } = {};
    if (editedDomain !== project.domain) updates.domain = editedDomain;
    if (editedPort && parseInt(editedPort) !== project.healthCheckPort) {
      updates.healthCheckPort = parseInt(editedPort);
    }
    if (Object.keys(updates).length > 0) {
      updateProjectMutation.mutate(updates);
    } else {
      setIsEditing(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">{project.name}</h1>
        <div className="space-x-2">
          <Button onClick={() => healthMutation.mutate()}>
            {healthMutation.isPending ? 'Checking...' : 'Check Health'}
          </Button>
          <Button onClick={() => restartMutation.mutate()} disabled={restartMutation.isPending}>
            {restartMutation.isPending ? 'Restarting...' : 'Restart All'}
          </Button>
          <Button variant="destructive" onClick={() => deleteMutation.mutate()}>
            Delete
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <CardTitle>Project Info</CardTitle>
              {!isEditing ? (
                <Button size="sm" variant="outline" onClick={handleStartEdit}>
                  Edit
                </Button>
              ) : (
                <div className="flex gap-2">
                  <Button size="sm" onClick={handleSaveEdit}>
                    Save
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setIsEditing(false)}>
                    Cancel
                  </Button>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Status:</span>
                <Badge className={getStatusColor(project.status)}>{project.status}</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Type:</span>
                <span>{project.type}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Path:</span>
                <code className="text-xs bg-muted px-1 rounded">{project.path}</code>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Domain:</span>
                {isEditing ? (
                  <Input
                    value={editedDomain}
                    onChange={(e) => setEditedDomain(e.target.value)}
                    className="w-48 h-8 text-sm"
                    placeholder="domain.example.com"
                  />
                ) : (
                  <span>{project.domain || '-'}</span>
                )}
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Port:</span>
                {isEditing ? (
                  <Input
                    value={editedPort}
                    onChange={(e) => setEditedPort(e.target.value)}
                    className="w-20 h-8 text-sm"
                    placeholder="3000"
                  />
                ) : (
                  <span>{project.healthCheckPort || '-'}</span>
                )}
              </div>
              {project.lastHealthCheck && (
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Last Check:</span>
                  <span className="text-xs">{project.lastHealthCheck}</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>System Resources</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">Project-specific resource usage:</p>
              {processes.length === 0 && containers.length === 0 ? (
                <p className="text-muted-foreground text-sm">No processes or containers found</p>
              ) : (
                <div className="space-y-2">
                  {processes.map((proc) => (
                    <div
                      key={proc.name}
                      className="flex justify-between items-center p-2 border rounded"
                    >
                      <div>
                        <p className="text-sm font-medium">{proc.name}</p>
                        <p className="text-xs text-muted-foreground">
                          PID: {proc.pid} | CPU: {proc.cpu.toFixed(1)}% | RAM:{' '}
                          {formatMemory(proc.memory)}
                        </p>
                      </div>
                      <Badge className={getStatusColor(proc.status)}>{proc.status}</Badge>
                    </div>
                  ))}
                  {containers.map((container) => (
                    <div
                      key={container.name}
                      className="flex justify-between items-center p-2 border rounded"
                    >
                      <div>
                        <p className="text-sm font-medium">{container.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {container.image} | CPU: {container.cpuPercent.toFixed(1)}% | RAM:{' '}
                          {container.memoryUsage}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge className={getStatusColor(container.state)}>{container.state}</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Containers</CardTitle>
        </CardHeader>
        <CardContent>
          {containers.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              No Docker containers found for this project
            </p>
          ) : (
            <div className="space-y-2">
              {containers.map((container) => (
                <div key={container.name} className="border rounded p-3">
                  <div className="flex justify-between items-center mb-2">
                    <div>
                      <p className="font-medium">{container.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {container.image} | ID: {container.id.slice(0, 12)}
                      </p>
                    </div>
                    <Badge className={getStatusColor(container.state)}>{container.state}</Badge>
                  </div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs">CPU: {container.cpuPercent.toFixed(1)}%</span>
                    <span className="text-xs">RAM: {container.memoryUsage}</span>
                    <span className="text-xs text-muted-foreground">
                      Status: {container.status}
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        containerActionMutation.mutate({ name: container.name, action: 'start' })
                      }
                      disabled={containerActionMutation.isPending || container.state === 'Up'}
                    >
                      Start
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        containerActionMutation.mutate({ name: container.name, action: 'stop' })
                      }
                      disabled={containerActionMutation.isPending || container.state !== 'Up'}
                    >
                      Stop
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        containerActionMutation.mutate({ name: container.name, action: 'restart' })
                      }
                      disabled={containerActionMutation.isPending}
                    >
                      Restart
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setSelectedContainerLogs(container.name);
                        void refetchContainerLogs();
                      }}
                    >
                      View Logs
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {selectedContainerLogs && (
        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <CardTitle>Logs: {selectedContainerLogs}</CardTitle>
              <Button size="sm" variant="ghost" onClick={() => setSelectedContainerLogs(null)}>
                Close
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="bg-muted rounded p-4 font-mono text-xs overflow-auto max-h-64">
              {containerLogsData?.data?.logs && containerLogsData.data.logs.length > 0 ? (
                containerLogsData.data.logs.map((line: string, i: number) => (
                  <div key={i} className="whitespace-pre-wrap">
                    {line}
                  </div>
                ))
              ) : (
                <p className="text-muted-foreground">No logs available</p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Recent Logs (PM2)</CardTitle>
        </CardHeader>
        <CardContent>
          {!logsData?.data?.logs || logsData.data.logs.length === 0 ? (
            <p className="text-muted-foreground text-sm">No logs available</p>
          ) : (
            <div className="bg-muted rounded p-4 font-mono text-xs overflow-auto max-h-64">
              {logsData.data.logs.map((line: string, i: number) => (
                <div key={i} className="whitespace-pre-wrap">
                  {line}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Instances</CardTitle>
        </CardHeader>
        <CardContent>
          {instances.length === 0 ? (
            <p className="text-muted-foreground text-sm">No instances linked</p>
          ) : (
            <div className="space-y-2">
              {instances.map((instance: ProjectInstance) => (
                <div
                  key={instance.id}
                  className="flex justify-between items-center p-2 border rounded"
                >
                  <div>
                    <p className="text-sm font-medium">{instance.serverName}</p>
                    <p className="text-xs text-muted-foreground">
                      {instance.pm2Name ? `PM2: ${instance.pm2Name}` : ''}
                      {instance.port ? ` Port: ${instance.port}` : ''}
                      {instance.pid ? ` PID: ${instance.pid}` : ''}
                    </p>
                  </div>
                  {instance.containerStatus && (
                    <Badge className={getStatusColor(instance.containerStatus)}>
                      {instance.containerStatus}
                    </Badge>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

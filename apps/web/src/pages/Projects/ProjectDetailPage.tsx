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

interface ProcessesResponse {
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
  };
}

interface LogResponse {
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

  const { data, isLoading, error } = useQuery<ProjectResponse>({
    queryKey: ['project', slug],
    queryFn: () => apiClient.get<ProjectResponse>(`/projects/${slug}`),
    enabled: !!slug,
  });

  const { data: processesData } = useQuery<ProcessesResponse>({
    queryKey: ['project-processes', slug],
    queryFn: () => apiClient.get<ProcessesResponse>(`/projects/${slug}/processes`),
    enabled: !!slug,
    refetchInterval: 10000,
  });

  const { data: logsData } = useQuery<LogResponse>({
    queryKey: ['project-logs', slug],
    queryFn: () => apiClient.get<LogResponse>(`/projects/${slug}/logs`),
    enabled: !!slug,
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
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['project-processes', slug] }),
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
  const processes = processesData?.data.processes ?? [];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'running':
      case 'online':
        return 'bg-green-500';
      case 'stopped':
        return 'bg-yellow-500';
      case 'error':
      case 'errored':
        return 'bg-red-500';
      default:
        return 'bg-gray-500';
    }
  };

  const formatUptime = (ms: number) => {
    if (!ms) return '-';
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    if (days > 0) return `${days}d ${hours % 24}h`;
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    return `${minutes}m`;
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
            {restartMutation.isPending ? 'Restarting...' : 'Restart'}
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
            <CardTitle>PM2 Processes</CardTitle>
          </CardHeader>
          <CardContent>
            {processes.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                No PM2 processes found for this project
              </p>
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
                    <div className="flex items-center gap-2">
                      <Badge className={getStatusColor(proc.status)}>{proc.status}</Badge>
                      <span className="text-xs text-muted-foreground">
                        {formatUptime(proc.uptime)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent Logs</CardTitle>
        </CardHeader>
        <CardContent>
          {!logsData?.data?.logs || logsData.data.logs.length === 0 ? (
            <p className="text-muted-foreground text-sm">No logs available</p>
          ) : (
            <div className="bg-muted rounded p-4 font-mono text-xs overflow-auto max-h-64">
              {logsData.data.logs.map((line, i) => (
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

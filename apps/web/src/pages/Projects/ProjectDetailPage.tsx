import { useParams } from '@tanstack/react-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/api/client';
import type { Project, ProjectInstance } from '@serverctrl/shared';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';

interface ProjectResponse {
  data: Project & { instances: ProjectInstance[] };
}

interface HealthResponse {
  data: {
    status: string;
    responseTime?: number;
  };
}

export function ProjectDetailPage() {
  const { slug } = useParams({ from: '/projects/$slug' });
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery<ProjectResponse>({
    queryKey: ['project', slug],
    queryFn: () => apiClient.get<ProjectResponse>(`/projects/${slug}`),
    enabled: !!slug,
  });

  const healthMutation = useMutation<HealthResponse>({
    mutationFn: () => apiClient.get<HealthResponse>(`/projects/${slug}/health`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['project', slug] }),
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

  const getStatusColor = (status: string) => {
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

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">{project.name}</h1>
        <div className="space-x-2">
          <Button onClick={() => healthMutation.mutate()}>
            {healthMutation.isPending ? 'Checking...' : 'Check Health'}
          </Button>
          <Button variant="destructive" onClick={() => deleteMutation.mutate()}>
            Delete
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Project Info</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm">
              <p>
                <span className="text-muted-foreground">Slug:</span> {project.slug}
              </p>
              <p>
                <span className="text-muted-foreground">Type:</span> {project.type}
              </p>
              <p>
                <span className="text-muted-foreground">Path:</span> {project.path}
              </p>
              <p>
                <span className="text-muted-foreground">Status:</span>{' '}
                <Badge className={getStatusColor(project.status)}>{project.status}</Badge>
              </p>
              {project.domain && (
                <p>
                  <span className="text-muted-foreground">Domain:</span> {project.domain}
                </p>
              )}
              {project.healthCheckUrl && (
                <p>
                  <span className="text-muted-foreground">Health URL:</span>{' '}
                  {project.healthCheckUrl}
                </p>
              )}
              {project.lastHealthCheck && (
                <p>
                  <span className="text-muted-foreground">Last Check:</span>{' '}
                  {project.lastHealthCheck}
                </p>
              )}
              {project.lastDeploy && (
                <p>
                  <span className="text-muted-foreground">Last Deploy:</span> {project.lastDeploy}
                </p>
              )}
            </div>
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
                        {instance.port ? `Port: ${instance.port}` : ''}
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
    </div>
  );
}

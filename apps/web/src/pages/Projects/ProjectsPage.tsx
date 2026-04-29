import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/api/client';
import type { Project } from '@serverctrl/shared';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';

interface ProjectsResponse {
  data: Project[];
}

interface DiscoverResponse {
  data: {
    discovered: number;
    errors: string[];
  };
}

export function ProjectsPage() {
  const queryClient = useQueryClient();
  const { data, isLoading, error } = useQuery<ProjectsResponse>({
    queryKey: ['projects'],
    queryFn: () => apiClient.get<ProjectsResponse>('/projects'),
  });

  const discoverMutation = useMutation<DiscoverResponse>({
    mutationFn: () => apiClient.get<DiscoverResponse>('/projects/discover'),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['projects'] }),
  });

  const projects = data?.data ?? [];

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error loading projects</div>;

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
        <h1 className="text-2xl font-bold">Projects</h1>
        <div className="space-x-2">
          <Button onClick={() => discoverMutation.mutate()}>
            {discoverMutation.isPending ? 'Discovering...' : 'Discover Projects'}
          </Button>
        </div>
      </div>

      {discoverMutation.data && (
        <Card>
          <CardContent>
            <p>Discovered {discoverMutation.data.data.discovered} new projects</p>
            {discoverMutation.data.data.errors.length > 0 && (
              <p className="text-destructive text-sm mt-2">
                Errors: {discoverMutation.data.data.errors.join(', ')}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {projects.length === 0 ? (
        <Card>
          <CardContent>
            <p className="text-muted-foreground">
              No projects found. Add a serpan.json to your project directories or create a project
              manually.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map((project) => (
            <Card key={project.id} className="hover:shadow-md transition-shadow">
              <CardHeader>
                <div className="flex justify-between items-start">
                  <CardTitle>{project.name}</CardTitle>
                  <Badge className={getStatusColor(project.status)}>{project.status}</Badge>
                </div>
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
                  {project.domain && (
                    <p>
                      <span className="text-muted-foreground">Domain:</span> {project.domain}
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

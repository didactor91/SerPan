import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/api/client';
import type { Project } from '@serverctrl/shared';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Input } from '@/components/ui/Input';

interface ProjectsResponse {
  data: Project[];
}

interface DiscoverResponse {
  data: {
    discovered: number;
    errors: string[];
  };
}

interface CreateProjectRequest {
  name: string;
  slug: string;
  type: 'pm2' | 'docker-compose' | 'generic';
  path: string;
  domain?: string;
  description?: string;
}

// eslint-disable-next-line max-lines-per-function, complexity
export function ProjectsPage() {
  const queryClient = useQueryClient();
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newProject, setNewProject] = useState<CreateProjectRequest>({
    name: '',
    slug: '',
    type: 'pm2',
    path: '',
    domain: '',
    description: '',
  });

  const { data, isLoading, error } = useQuery<ProjectsResponse>({
    queryKey: ['projects'],
    queryFn: () => apiClient.get<ProjectsResponse>('/projects'),
  });

  const discoverMutation = useMutation<DiscoverResponse>({
    mutationFn: () => apiClient.get<DiscoverResponse>('/projects/discover'),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['projects'] });
    },
  });

  const createProjectMutation = useMutation({
    mutationFn: (project: CreateProjectRequest) => apiClient.post('/projects', project),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['projects'] });
      setShowCreateForm(false);
      setNewProject({ name: '', slug: '', type: 'pm2', path: '', domain: '', description: '' });
    },
  });

  const projects = data?.data ?? [];

  const handleNameChange = (name: string) => {
    setNewProject((prev) => ({
      ...prev,
      name,
      slug: name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, ''),
    }));
  };

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
          <Button onClick={() => setShowCreateForm(!showCreateForm)}>
            {showCreateForm ? 'Cancel' : 'Create Project'}
          </Button>
        </div>
      </div>

      {showCreateForm && (
        <Card>
          <CardHeader>
            <CardTitle>Create New Project</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">Name</label>
                <Input
                  value={newProject.name}
                  onChange={(e) => handleNameChange(e.target.value)}
                  placeholder="My Project"
                  className="mt-1"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Slug</label>
                <Input
                  value={newProject.slug}
                  onChange={(e) => setNewProject((prev) => ({ ...prev, slug: e.target.value }))}
                  placeholder="my-project"
                  className="mt-1"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Type</label>
                <select
                  value={newProject.type}
                  onChange={(e) =>
                    setNewProject((prev) => ({
                      ...prev,
                      type: e.target.value as CreateProjectRequest['type'],
                    }))
                  }
                  className="w-full mt-1 p-2 border rounded"
                >
                  <option value="pm2">PM2</option>
                  <option value="docker-compose">Docker Compose</option>
                  <option value="generic">Generic</option>
                </select>
              </div>
              <div>
                <label className="text-sm font-medium">Path</label>
                <Input
                  value={newProject.path}
                  onChange={(e) => setNewProject((prev) => ({ ...prev, path: e.target.value }))}
                  placeholder="/opt/my-project"
                  className="mt-1"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Domain (optional)</label>
                <Input
                  value={newProject.domain ?? ''}
                  onChange={(e) => setNewProject((prev) => ({ ...prev, domain: e.target.value }))}
                  placeholder="myproject.example.com"
                  className="mt-1"
                />
              </div>
              <Button
                onClick={() => createProjectMutation.mutate(newProject)}
                disabled={
                  !newProject.name || !newProject.slug || !newProject.path || !newProject.type
                }
              >
                {createProjectMutation.isPending ? 'Creating...' : 'Create Project'}
              </Button>
              {createProjectMutation.error && (
                <p className="text-destructive text-sm">Failed to create project</p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

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
                  <a
                    href={`/projects/${project.slug}`}
                    className="inline-block mt-2 text-sm text-primary hover:underline"
                  >
                    View Details →
                  </a>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

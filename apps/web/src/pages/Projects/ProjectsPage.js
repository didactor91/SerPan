import { jsx as _jsx, jsxs as _jsxs } from 'react/jsx-runtime';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/api/client';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Input } from '@/components/ui/Input';
// eslint-disable-next-line max-lines-per-function, complexity
export function ProjectsPage() {
  const queryClient = useQueryClient();
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newProject, setNewProject] = useState({
    name: '',
    slug: '',
    type: 'pm2',
    path: '',
    domain: '',
    description: '',
  });
  const { data, isLoading, error } = useQuery({
    queryKey: ['projects'],
    queryFn: () => apiClient.get('/projects'),
  });
  const discoverMutation = useMutation({
    mutationFn: () => apiClient.get('/projects/discover'),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['projects'] });
    },
  });
  const createProjectMutation = useMutation({
    mutationFn: (project) => apiClient.post('/projects', project),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['projects'] });
      setShowCreateForm(false);
      setNewProject({ name: '', slug: '', type: 'pm2', path: '', domain: '', description: '' });
    },
  });
  const projects = data?.data ?? [];
  const handleNameChange = (name) => {
    setNewProject((prev) => ({
      ...prev,
      name,
      slug: name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, ''),
    }));
  };
  if (isLoading) return _jsx('div', { children: 'Loading...' });
  if (error) return _jsx('div', { children: 'Error loading projects' });
  const getStatusColor = (status) => {
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
  return _jsxs('div', {
    className: 'p-6 space-y-6',
    children: [
      _jsxs('div', {
        className: 'flex justify-between items-center',
        children: [
          _jsx('h1', { className: 'text-2xl font-bold', children: 'Projects' }),
          _jsxs('div', {
            className: 'space-x-2',
            children: [
              _jsx(Button, {
                onClick: () => discoverMutation.mutate(),
                children: discoverMutation.isPending ? 'Discovering...' : 'Discover Projects',
              }),
              _jsx(Button, {
                onClick: () => setShowCreateForm(!showCreateForm),
                children: showCreateForm ? 'Cancel' : 'Create Project',
              }),
            ],
          }),
        ],
      }),
      showCreateForm &&
        _jsxs(Card, {
          children: [
            _jsx(CardHeader, { children: _jsx(CardTitle, { children: 'Create New Project' }) }),
            _jsx(CardContent, {
              children: _jsxs('div', {
                className: 'space-y-4',
                children: [
                  _jsxs('div', {
                    children: [
                      _jsx('label', { className: 'text-sm font-medium', children: 'Name' }),
                      _jsx(Input, {
                        value: newProject.name,
                        onChange: (e) => handleNameChange(e.target.value),
                        placeholder: 'My Project',
                        className: 'mt-1',
                      }),
                    ],
                  }),
                  _jsxs('div', {
                    children: [
                      _jsx('label', { className: 'text-sm font-medium', children: 'Slug' }),
                      _jsx(Input, {
                        value: newProject.slug,
                        onChange: (e) =>
                          setNewProject((prev) => ({ ...prev, slug: e.target.value })),
                        placeholder: 'my-project',
                        className: 'mt-1',
                      }),
                    ],
                  }),
                  _jsxs('div', {
                    children: [
                      _jsx('label', { className: 'text-sm font-medium', children: 'Type' }),
                      _jsxs('select', {
                        value: newProject.type,
                        onChange: (e) =>
                          setNewProject((prev) => ({
                            ...prev,
                            type: e.target.value,
                          })),
                        className: 'w-full mt-1 p-2 border rounded',
                        children: [
                          _jsx('option', { value: 'pm2', children: 'PM2' }),
                          _jsx('option', { value: 'docker-compose', children: 'Docker Compose' }),
                          _jsx('option', { value: 'generic', children: 'Generic' }),
                        ],
                      }),
                    ],
                  }),
                  _jsxs('div', {
                    children: [
                      _jsx('label', { className: 'text-sm font-medium', children: 'Path' }),
                      _jsx(Input, {
                        value: newProject.path,
                        onChange: (e) =>
                          setNewProject((prev) => ({ ...prev, path: e.target.value })),
                        placeholder: '/opt/my-project',
                        className: 'mt-1',
                      }),
                    ],
                  }),
                  _jsxs('div', {
                    children: [
                      _jsx('label', {
                        className: 'text-sm font-medium',
                        children: 'Domain (optional)',
                      }),
                      _jsx(Input, {
                        value: newProject.domain ?? '',
                        onChange: (e) =>
                          setNewProject((prev) => ({ ...prev, domain: e.target.value })),
                        placeholder: 'myproject.example.com',
                        className: 'mt-1',
                      }),
                    ],
                  }),
                  _jsx(Button, {
                    onClick: () => createProjectMutation.mutate(newProject),
                    disabled:
                      !newProject.name || !newProject.slug || !newProject.path || !newProject.type,
                    children: createProjectMutation.isPending ? 'Creating...' : 'Create Project',
                  }),
                  createProjectMutation.error &&
                    _jsx('p', {
                      className: 'text-destructive text-sm',
                      children: 'Failed to create project',
                    }),
                ],
              }),
            }),
          ],
        }),
      discoverMutation.data &&
        _jsx(Card, {
          children: _jsxs(CardContent, {
            children: [
              _jsxs('p', {
                children: ['Discovered ', discoverMutation.data.data.discovered, ' new projects'],
              }),
              discoverMutation.data.data.errors.length > 0 &&
                _jsxs('p', {
                  className: 'text-destructive text-sm mt-2',
                  children: ['Errors: ', discoverMutation.data.data.errors.join(', ')],
                }),
            ],
          }),
        }),
      projects.length === 0
        ? _jsx(Card, {
            children: _jsx(CardContent, {
              children: _jsx('p', {
                className: 'text-muted-foreground',
                children:
                  'No projects found. Add a serpan.json to your project directories or create a project manually.',
              }),
            }),
          })
        : _jsx('div', {
            className: 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4',
            children: projects.map((project) =>
              _jsxs(
                Card,
                {
                  className: 'hover:shadow-md transition-shadow',
                  children: [
                    _jsx(CardHeader, {
                      children: _jsxs('div', {
                        className: 'flex justify-between items-start',
                        children: [
                          _jsx(CardTitle, { children: project.name }),
                          _jsx(Badge, {
                            className: getStatusColor(project.status),
                            children: project.status,
                          }),
                        ],
                      }),
                    }),
                    _jsx(CardContent, {
                      children: _jsxs('div', {
                        className: 'space-y-2 text-sm',
                        children: [
                          _jsxs('p', {
                            children: [
                              _jsx('span', {
                                className: 'text-muted-foreground',
                                children: 'Slug:',
                              }),
                              ' ',
                              project.slug,
                            ],
                          }),
                          _jsxs('p', {
                            children: [
                              _jsx('span', {
                                className: 'text-muted-foreground',
                                children: 'Type:',
                              }),
                              ' ',
                              project.type,
                            ],
                          }),
                          _jsxs('p', {
                            children: [
                              _jsx('span', {
                                className: 'text-muted-foreground',
                                children: 'Path:',
                              }),
                              ' ',
                              project.path,
                            ],
                          }),
                          project.domain &&
                            _jsxs('p', {
                              children: [
                                _jsx('span', {
                                  className: 'text-muted-foreground',
                                  children: 'Domain:',
                                }),
                                ' ',
                                project.domain,
                              ],
                            }),
                          _jsx('a', {
                            href: `/projects/${project.slug}`,
                            className: 'inline-block mt-2 text-sm text-primary hover:underline',
                            children: 'View Details \u2192',
                          }),
                        ],
                      }),
                    }),
                  ],
                },
                project.id,
              ),
            ),
          }),
    ],
  });
}

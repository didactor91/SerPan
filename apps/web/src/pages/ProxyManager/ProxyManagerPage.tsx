import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/api/client';
import { useNotificationsStore } from '@/stores/notifications.store';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { Badge } from '@/components/ui/Badge';
import { SnapshotHistory } from './SnapshotHistory';

interface ProxyRoute {
  id: string;
  host: string;
  upstreamPort: number;
  upstreamHost: string;
  tls: boolean;
  createdAt?: string;
}

interface CaddyConfig {
  routes: ProxyRoute[];
}

interface RouteFormData {
  host: string;
  upstreamHost: string;
  upstreamPort: string;
  tls: boolean;
}

function CaddyConfigPreview({ config }: { config: RouteFormData }) {
  const lines = [
    '{',
    '  # Proxy route for ' + config.host,
    '  @' + config.host.replace(/\./g, '_') + ' host ' + config.host,
    '  reverse_proxy @' +
      config.host.replace(/\./g, '_') +
      ' ' +
      config.upstreamHost +
      ':' +
      config.upstreamPort,
    '}',
  ];
  if (config.tls) {
    lines.push('  # TLS enabled');
    lines.push('  tls internal');
  }
  lines.push('}');
  return <pre className="bg-muted p-4 rounded-md text-sm overflow-x-auto">{lines.join('\n')}</pre>;
}

export function ProxyManagerPage() {
  const queryClient = useQueryClient();
  const { add } = useNotificationsStore();
  const [showAddModal, setShowAddModal] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [editingRoute, setEditingRoute] = useState<ProxyRoute | null>(null);
  const [showSnapshots, setShowSnapshots] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const [formData, setFormData] = useState<RouteFormData>({
    host: '',
    upstreamHost: 'localhost',
    upstreamPort: '3000',
    tls: true,
  });

  const { data, isLoading, error } = useQuery<{ data: CaddyConfig }>({
    queryKey: ['proxy-routes'],
    queryFn: () => apiClient.get('/proxy/routes'),
  });

  const addMutation = useMutation({
    mutationFn: (route: {
      host: string;
      upstreamPort: number;
      tls: boolean;
      upstreamHost?: string;
    }) => {
      // API expects host, upstreamPort, tls — upstreamHost is part of the route concept
      return apiClient.post('/proxy/routes', route);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['proxy-routes'] });
      setShowAddModal(false);
      resetForm();
      add({ type: 'success', message: 'Route added successfully' });
    },
    onError: (err: Error) => {
      add({ type: 'error', message: err.message || 'Failed to add route' });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({
      id,
      ...route
    }: {
      id: string;
      host: string;
      upstreamPort: number;
      tls: boolean;
    }) => {
      return apiClient.put(`/proxy/routes/${id}`, route);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['proxy-routes'] });
      setEditingRoute(null);
      resetForm();
      add({ type: 'success', message: 'Route updated successfully' });
    },
    onError: (err: Error) => {
      add({ type: 'error', message: err.message || 'Failed to update route' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/proxy/routes/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['proxy-routes'] });
      setDeleteConfirm(null);
      add({ type: 'success', message: 'Route deleted successfully' });
    },
    onError: (err: Error) => {
      add({ type: 'error', message: err.message || 'Failed to delete route' });
    },
  });

  const resetForm = useCallback(() => {
    setFormData({ host: '', upstreamHost: 'localhost', upstreamPort: '3000', tls: true });
  }, []);

  const handleSubmit = useCallback(() => {
    const port = parseInt(formData.upstreamPort, 10);
    if (!formData.host || isNaN(port) || port < 1 || port > 65535) {
      add({ type: 'error', message: 'Please fill in all required fields correctly' });
      return;
    }

    const routeData = {
      host: formData.host,
      upstreamPort: port,
      tls: formData.tls,
    };

    if (editingRoute) {
      updateMutation.mutate({ id: editingRoute.id, ...routeData });
    } else {
      addMutation.mutate(routeData);
    }
  }, [formData, editingRoute, addMutation, updateMutation, add]);

  const startEdit = useCallback((route: ProxyRoute) => {
    setEditingRoute(route);
    setFormData({
      host: route.host,
      upstreamHost: route.upstreamHost || 'localhost',
      upstreamPort: String(route.upstreamPort),
      tls: route.tls,
    });
    setShowAddModal(true);
  }, []);

  if (showSnapshots) {
    return <SnapshotHistory onBack={() => setShowSnapshots(false)} />;
  }

  if (isLoading) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold mb-6">Proxy Manager</h1>
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold mb-6">Proxy Manager</h1>
        <p className="text-destructive">Failed to load routes</p>
      </div>
    );
  }

  const routes = data?.data?.routes ?? [];

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Proxy Manager</h1>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowSnapshots(true)}>
            Snapshots
          </Button>
          <Button
            onClick={() => {
              resetForm();
              setShowAddModal(true);
            }}
          >
            Add Route
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <table className="w-full">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left p-3 font-medium">Hostname</th>
                <th className="text-left p-3 font-medium">Upstream</th>
                <th className="text-center p-3 font-medium">TLS</th>
                <th className="text-right p-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {routes.length === 0 ? (
                <tr>
                  <td colSpan={4} className="p-6 text-center text-muted-foreground">
                    No routes configured
                  </td>
                </tr>
              ) : (
                routes.map((route) => (
                  <tr key={route.id} className="border-b">
                    <td className="p-3 font-medium">{route.host}</td>
                    <td className="p-3 text-muted-foreground">
                      {route.upstreamHost || 'localhost'}:{route.upstreamPort}
                    </td>
                    <td className="p-3 text-center">
                      <Badge variant={route.tls ? 'default' : 'secondary'}>
                        {route.tls ? 'Enabled' : 'Disabled'}
                      </Badge>
                    </td>
                    <td className="p-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button size="sm" variant="ghost" onClick={() => startEdit(route)}>
                          Edit
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setDeleteConfirm(route.id)}
                        >
                          Delete
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* Add/Edit Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-background rounded-lg p-6 w-full max-w-md shadow-xl">
            <h2 className="text-lg font-semibold mb-4">
              {editingRoute ? 'Edit Route' : 'Add Route'}
            </h2>

            <div className="space-y-4">
              <div>
                <Label htmlFor="host" required>
                  Hostname
                </Label>
                <Input
                  id="host"
                  value={formData.host}
                  onChange={(e) => setFormData({ ...formData, host: e.target.value })}
                  placeholder="example.com"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="upstreamHost">Upstream Host</Label>
                  <Input
                    id="upstreamHost"
                    value={formData.upstreamHost}
                    onChange={(e) => setFormData({ ...formData, upstreamHost: e.target.value })}
                    placeholder="localhost"
                  />
                </div>
                <div>
                  <Label htmlFor="upstreamPort" required>
                    Port
                  </Label>
                  <Input
                    id="upstreamPort"
                    type="number"
                    min="1"
                    max="65535"
                    value={formData.upstreamPort}
                    onChange={(e) => setFormData({ ...formData, upstreamPort: e.target.value })}
                    placeholder="3000"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="tls"
                  checked={formData.tls}
                  onChange={(e) => setFormData({ ...formData, tls: e.target.checked })}
                  className="h-4 w-4"
                />
                <Label htmlFor="tls" className="cursor-pointer">
                  Enable TLS
                </Label>
              </div>

              <button
                type="button"
                onClick={() => setShowPreview(!showPreview)}
                className="text-sm text-muted-foreground hover:text-foreground"
              >
                {showPreview ? 'Hide Preview' : 'Show Preview'}
              </button>

              {showPreview && <CaddyConfigPreview config={formData} />}
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <Button
                variant="outline"
                onClick={() => {
                  setShowAddModal(false);
                  setEditingRoute(null);
                  resetForm();
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={addMutation.isPending || updateMutation.isPending}
              >
                {editingRoute ? 'Update' : 'Add'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-background rounded-lg p-6 w-full max-w-sm shadow-xl">
            <h2 className="text-lg font-semibold mb-4">Confirm Delete</h2>
            <p className="text-muted-foreground mb-6">
              Are you sure you want to delete this route? This action cannot be undone.
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setDeleteConfirm(null)}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={() => deleteMutation.mutate(deleteConfirm)}
                disabled={deleteMutation.isPending}
              >
                Delete
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/api/client';
import { useNotificationsStore, Notification } from '@/stores/notifications.store';
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
  upstreamHost?: string;
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

interface RouteTableProps {
  routes: ProxyRoute[];
  onEdit: (route: ProxyRoute) => void;
  onDelete: (id: string) => void;
}

function RouteTable({ routes, onEdit, onDelete }: RouteTableProps) {
  return (
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
                    {(route.upstreamHost ?? 'localhost') + ':' + String(route.upstreamPort)}
                  </td>
                  <td className="p-3 text-center">
                    <Badge variant={route.tls ? 'default' : 'secondary'}>
                      {route.tls ? 'Enabled' : 'Disabled'}
                    </Badge>
                  </td>
                  <td className="p-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button size="sm" variant="ghost" onClick={() => onEdit(route)}>
                        Edit
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => onDelete(route.id)}>
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
  );
}

function PageHeader() {
  return <h1 className="text-2xl font-bold">Proxy Manager</h1>;
}

interface ToolbarProps {
  onAddRoute: () => void;
  onViewSnapshots: () => void;
}

function Toolbar({ onAddRoute, onViewSnapshots }: ToolbarProps) {
  return (
    <div className="flex gap-2">
      <Button variant="outline" onClick={onViewSnapshots}>
        Snapshots
      </Button>
      <Button onClick={onAddRoute}>Add Route</Button>
    </div>
  );
}

interface RouteFormAreaProps {
  showAddModal: boolean;
  editingRoute: ProxyRoute | null;
  formData: RouteFormData;
  showPreview: boolean;
  isPending: boolean;
  onFormDataChange: (data: RouteFormData) => void;
  onShowPreviewChange: (show: boolean) => void;
  onSubmit: () => void;
  onCancel: () => void;
}

function RouteFormArea({
  showAddModal,
  editingRoute,
  formData,
  showPreview,
  isPending,
  onFormDataChange,
  onShowPreviewChange,
  onSubmit,
  onCancel,
}: RouteFormAreaProps) {
  if (!showAddModal) return null;

  return (
    <RouteFormModal
      editingRoute={editingRoute}
      formData={formData}
      showPreview={showPreview}
      isPending={isPending}
      onFormDataChange={onFormDataChange}
      onShowPreviewChange={onShowPreviewChange}
      onSubmit={onSubmit}
      onCancel={onCancel}
    />
  );
}

interface UseProxyManagerReturn {
  showSnapshots: boolean;
  setShowSnapshots: (show: boolean) => void;
  isLoading: boolean;
  error: unknown;
  routes: ProxyRoute[];
  showAddModal: boolean;
  setShowAddModal: (show: boolean) => void;
  showPreview: boolean;
  setShowPreview: (show: boolean) => void;
  editingRoute: ProxyRoute | null;
  setEditingRoute: (route: ProxyRoute | null) => void;
  deleteConfirm: string | null;
  setDeleteConfirm: (id: string | null) => void;
  formData: RouteFormData;
  setFormData: (data: RouteFormData) => void;
  isFormPending: boolean;
  isDeletePending: boolean;
  deleteMutation: ReturnType<typeof useMutation<unknown, Error, string, unknown>>;
  handleSubmit: () => void;
  startEdit: (route: ProxyRoute) => void;
  resetForm: () => void;
}

function useProxyManager(): UseProxyManagerReturn {
  const queryClient = useQueryClient();
  const { add } = useNotificationsStore();

  const [showSnapshots, setShowSnapshots] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [editingRoute, setEditingRoute] = useState<ProxyRoute | null>(null);
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

  const resetForm = useCallback(() => {
    setFormData({ host: '', upstreamHost: 'localhost', upstreamPort: '3000', tls: true });
  }, []);

  const { addMutation, updateMutation, deleteMutation } = useRouteMutations({
    queryClient,
    add,
    resetForm,
    setShowAddModal,
    setEditingRoute,
    setDeleteConfirm,
  });

  const handleSubmit = useCallback(() => {
    const port = parseInt(formData.upstreamPort, 10);
    if (!formData.host || isNaN(port) || port < 1 || port > 65535) {
      add({ type: 'error', message: 'Please fill in all required fields correctly' });
      return;
    }
    const routeData = { host: formData.host, upstreamPort: port, tls: formData.tls };
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
      upstreamHost: route.upstreamHost ?? 'localhost',
      upstreamPort: String(route.upstreamPort),
      tls: route.tls,
    });
    setShowAddModal(true);
  }, []);

  return {
    showSnapshots,
    setShowSnapshots,
    isLoading,
    error: error ?? null,
    routes: data?.data.routes ?? [],
    showAddModal,
    setShowAddModal,
    showPreview,
    setShowPreview,
    editingRoute,
    setEditingRoute,
    deleteConfirm,
    setDeleteConfirm,
    formData,
    setFormData,
    isFormPending: addMutation.isPending || updateMutation.isPending,
    isDeletePending: deleteMutation.isPending,
    deleteMutation,
    handleSubmit,
    startEdit,
    resetForm,
  };
}

function useRouteMutations(callbacks: {
  queryClient: ReturnType<typeof useQueryClient>;
  add: (notification: Omit<Notification, 'id'>) => void;
  resetForm: () => void;
  setShowAddModal: (show: boolean) => void;
  setEditingRoute: (route: ProxyRoute | null) => void;
  setDeleteConfirm: (id: string | null) => void;
}) {
  const { queryClient, add, resetForm, setShowAddModal, setEditingRoute, setDeleteConfirm } =
    callbacks;

  const addMutation = useMutation({
    mutationFn: (route: {
      host: string;
      upstreamPort: number;
      tls: boolean;
      upstreamHost?: string;
    }) => {
      return apiClient.post('/proxy/routes', route);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['proxy-routes'] });
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
      void queryClient.invalidateQueries({ queryKey: ['proxy-routes'] });
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
      void queryClient.invalidateQueries({ queryKey: ['proxy-routes'] });
      setDeleteConfirm(null);
      add({ type: 'success', message: 'Route deleted successfully' });
    },
    onError: (err: Error) => {
      add({ type: 'error', message: err.message || 'Failed to delete route' });
    },
  });

  return { addMutation, updateMutation, deleteMutation };
}

interface RouteFormModalProps {
  editingRoute: ProxyRoute | null;
  formData: RouteFormData;
  showPreview: boolean;
  isPending: boolean;
  onFormDataChange: (data: RouteFormData) => void;
  onShowPreviewChange: (show: boolean) => void;
  onSubmit: () => void;
  onCancel: () => void;
}

function RouteFormModal({
  editingRoute,
  formData,
  showPreview,
  isPending,
  onFormDataChange,
  onShowPreviewChange,
  onSubmit,
  onCancel,
}: RouteFormModalProps) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-background rounded-lg p-6 w-full max-w-md shadow-xl">
        <h2 className="text-lg font-semibold mb-4">{editingRoute ? 'Edit Route' : 'Add Route'}</h2>

        <div className="space-y-4">
          <div>
            <Label htmlFor="host" required>
              Hostname
            </Label>
            <Input
              id="host"
              value={formData.host}
              onChange={(e) => onFormDataChange({ ...formData, host: e.target.value })}
              placeholder="example.com"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="upstreamHost">Upstream Host</Label>
              <Input
                id="upstreamHost"
                value={formData.upstreamHost}
                onChange={(e) => onFormDataChange({ ...formData, upstreamHost: e.target.value })}
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
                onChange={(e) => onFormDataChange({ ...formData, upstreamPort: e.target.value })}
                placeholder="3000"
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="tls"
              checked={formData.tls}
              onChange={(e) => onFormDataChange({ ...formData, tls: e.target.checked })}
              className="h-4 w-4"
            />
            <Label htmlFor="tls" className="cursor-pointer">
              Enable TLS
            </Label>
          </div>

          <button
            type="button"
            onClick={() => onShowPreviewChange(!showPreview)}
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            {showPreview ? 'Hide Preview' : 'Show Preview'}
          </button>

          {showPreview && <CaddyConfigPreview config={formData} />}
        </div>

        <div className="flex justify-end gap-2 mt-6">
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button onClick={onSubmit} disabled={isPending}>
            {editingRoute ? 'Update' : 'Add'}
          </Button>
        </div>
      </div>
    </div>
  );
}

interface DeleteConfirmModalProps {
  routeId: string | null;
  isPending: boolean;
  onConfirm: (id: string) => void;
  onCancel: () => void;
}

function DeleteConfirmModal({ routeId, isPending, onConfirm, onCancel }: DeleteConfirmModalProps) {
  if (!routeId) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-background rounded-lg p-6 w-full max-w-sm shadow-xl">
        <h2 className="text-lg font-semibold mb-4">Confirm Delete</h2>
        <p className="text-muted-foreground mb-6">
          Are you sure you want to delete this route? This action cannot be undone.
        </p>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={() => onConfirm(routeId)} disabled={isPending}>
            Delete
          </Button>
        </div>
      </div>
    </div>
  );
}

export function ProxyManagerPage() {
  const {
    showSnapshots,
    setShowSnapshots,
    isLoading,
    error,
    routes,
    showAddModal,
    setShowAddModal,
    showPreview,
    setShowPreview,
    editingRoute,
    setEditingRoute,
    deleteConfirm,
    setDeleteConfirm,
    formData,
    setFormData,
    isFormPending,
    isDeletePending,
    deleteMutation,
    handleSubmit,
    startEdit,
    resetForm,
  } = useProxyManager();

  if (showSnapshots) {
    return <SnapshotHistory onBack={() => setShowSnapshots(false)} />;
  }

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
        <p className="text-destructive">Failed to load routes</p>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <PageHeader />
        <Toolbar
          onAddRoute={() => {
            resetForm();
            setShowAddModal(true);
          }}
          onViewSnapshots={() => setShowSnapshots(true)}
        />
      </div>

      <RouteTable routes={routes} onEdit={startEdit} onDelete={setDeleteConfirm} />

      <RouteFormArea
        showAddModal={showAddModal}
        editingRoute={editingRoute}
        formData={formData}
        showPreview={showPreview}
        isPending={isFormPending}
        onFormDataChange={setFormData}
        onShowPreviewChange={setShowPreview}
        onSubmit={handleSubmit}
        onCancel={() => {
          setShowAddModal(false);
          setEditingRoute(null);
          resetForm();
        }}
      />

      <DeleteConfirmModal
        routeId={deleteConfirm}
        isPending={isDeletePending}
        onConfirm={(id) => deleteMutation.mutate(id)}
        onCancel={() => setDeleteConfirm(null)}
      />
    </div>
  );
}

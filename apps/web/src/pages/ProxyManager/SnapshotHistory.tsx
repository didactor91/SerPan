import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/api/client';
import { useNotificationsStore } from '@/stores/notifications.store';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';
import { format } from 'date-fns';

interface Snapshot {
  id: string;
  description: string;
  configSnapshot: string;
  createdAt: string;
}

interface SnapshotResponse {
  data: {
    snapshots: Snapshot[];
  };
}

interface DiffLine {
  type: 'added' | 'removed' | 'unchanged';
  content: string;
}

function simpleDiff(text1: string, text2: string): DiffLine[] {
  const lines1 = text1.split('\n');
  const lines2 = text2.split('\n');
  const result: DiffLine[] = [];

  const maxLen = Math.max(lines1.length, lines2.length);
  for (let i = 0; i < maxLen; i++) {
    const l1 = lines1[i];
    const l2 = lines2[i] ?? '';
    if (l1 === undefined) {
      result.push({ type: 'added', content: l2 });
    } else if (l1 !== l2) {
      result.push({ type: 'removed', content: l1 });
      result.push({ type: 'added', content: l2 });
    } else {
      result.push({ type: 'unchanged', content: l1 });
    }
  }

  return result;
}

function DiffView({ oldText, newText }: { oldText: string; newText: string }) {
  const diffLines = simpleDiff(oldText, newText);

  return (
    <div className="bg-muted rounded-md p-4 overflow-x-auto text-sm font-mono">
      {diffLines.map((line, index) => (
        <div
          key={index}
          className={
            line.type === 'added'
              ? 'bg-green-900/30 text-green-400'
              : line.type === 'removed'
                ? 'bg-red-900/30 text-red-400'
                : 'text-muted-foreground'
          }
        >
          {line.type === 'added' ? '+ ' : line.type === 'removed' ? '- ' : '  '}
          {line.content}
        </div>
      ))}
    </div>
  );
}

interface SnapshotHistoryProps {
  onBack: () => void;
}

export function SnapshotHistory({ onBack }: SnapshotHistoryProps) {
  const queryClient = useQueryClient();
  const { add } = useNotificationsStore();
  const [selectedSnapshot, setSelectedSnapshot] = useState<Snapshot | null>(null);
  const [showDiff, setShowDiff] = useState(false);
  const [rollbackConfirm, setRollbackConfirm] = useState<string | null>(null);

  const { data, isLoading, error } = useQuery<SnapshotResponse>({
    queryKey: ['proxy-snapshots'],
    queryFn: () => apiClient.get('/proxy/snapshots'),
  });

  const rollbackMutation = useMutation({
    mutationFn: (id: string) => apiClient.post(`/proxy/rollback/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['proxy-routes'] });
      setRollbackConfirm(null);
      add({ type: 'success', message: 'Rollback completed successfully' });
      onBack();
    },
    onError: (err: Error) => {
      add({ type: 'error', message: err.message || 'Failed to rollback' });
    },
  });

  const currentConfig = JSON.stringify(data?.data?.snapshots?.[0], null, 2) ?? '';

  if (isLoading) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold mb-6">Snapshot History</h1>
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold mb-6">Snapshot History</h1>
        <p className="text-destructive">Failed to load snapshots</p>
      </div>
    );
  }

  const snapshots = data?.data?.snapshots ?? [];

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Snapshot History</h1>
        <Button variant="outline" onClick={onBack}>
          Back to Routes
        </Button>
      </div>

      {snapshots.length === 0 ? (
        <Card>
          <CardContent className="p-6">
            <p className="text-muted-foreground text-center">No snapshots available</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {snapshots.map((snapshot) => (
            <Card key={snapshot.id}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">{snapshot.description}</p>
                    <p className="text-sm text-muted-foreground">
                      {format(new Date(snapshot.createdAt), 'PPpp')}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setSelectedSnapshot(snapshot);
                        setShowDiff(true);
                      }}
                    >
                      View Diff
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => setRollbackConfirm(snapshot.id)}
                    >
                      Rollback
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Diff Modal */}
      {showDiff && selectedSnapshot && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-background rounded-lg p-6 w-full max-w-3xl shadow-xl max-h-[80vh] overflow-auto">
            <h2 className="text-lg font-semibold mb-4">Diff: {selectedSnapshot.description}</h2>
            <p className="text-sm text-muted-foreground mb-4">
              Comparing snapshot (left) vs current config (right)
            </p>
            <DiffView oldText={selectedSnapshot.configSnapshot} newText={currentConfig} />
            <div className="flex justify-end mt-4">
              <Button onClick={() => setShowDiff(false)}>Close</Button>
            </div>
          </div>
        </div>
      )}

      {/* Rollback Confirmation */}
      {rollbackConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-background rounded-lg p-6 w-full max-w-sm shadow-xl">
            <h2 className="text-lg font-semibold mb-4">Confirm Rollback</h2>
            <p className="text-muted-foreground mb-6">
              This will restore the proxy configuration to the selected snapshot. A new snapshot
              will be created before making changes.
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setRollbackConfirm(null)}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={() => rollbackMutation.mutate(rollbackConfirm)}
                disabled={rollbackMutation.isPending}
              >
                Rollback
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

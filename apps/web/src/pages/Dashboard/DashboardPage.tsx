import { useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/api/client';
import type { PM2Process, SystemMetrics } from '@serverctrl/shared';
import { ServerSummary } from '@/components/shared/ServerSummary';
import { ProjectCard } from '@/components/shared/ProjectCard';
import { Card, CardContent } from '@/components/ui/Card';
import { useWebSocket } from '@/hooks/useWebSocket';

export function DashboardPage() {
  const [liveMetrics, setLiveMetrics] = useState<SystemMetrics | null>(null);

  const handleMetricsUpdate = useCallback((metrics: SystemMetrics) => {
    setLiveMetrics(metrics);
  }, []);

  // Connect WebSocket for live metrics
  useWebSocket({ onMetricsUpdate: handleMetricsUpdate });

  const {
    data: processesData,
    isLoading,
    error,
  } = useQuery<{ data: { processes: PM2Process[] } }>({
    queryKey: ['processes'],
    queryFn: () => apiClient.get('/processes'),
    refetchInterval: 5000, // Refresh every 5s
  });

  const processes = processesData?.data?.processes ?? [];

  if (isLoading) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold mb-6">Dashboard</h1>
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold mb-6">Dashboard</h1>
        <p className="text-destructive">Failed to load dashboard data</p>
      </div>
    );
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Dashboard</h1>

      <div className="space-y-6">
        {/* Server Summary - use liveMetrics when available, fall back to query data */}
        <ServerSummary liveMetrics={liveMetrics} />

        {/* Projects Grid */}
        <div>
          <h2 className="text-lg font-semibold mb-4">Projects</h2>
          {processes.length === 0 ? (
            <Card>
              <CardContent className="p-6">
                <p className="text-muted-foreground">No projects found</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {processes.map((process) => (
                <ProjectCard key={process.name} name={process.name} process={process} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

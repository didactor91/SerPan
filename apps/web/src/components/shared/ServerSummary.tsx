import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/api/client';
import type { SystemMetrics } from '@serverctrl/shared';
import { MetricCard } from './MetricCard';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';

interface ServerSummaryProps {
  liveMetrics?: SystemMetrics | null;
}

export function ServerSummary({ liveMetrics }: ServerSummaryProps) {
  const { data, isLoading, error } = useQuery<{ data: SystemMetrics }>({
    queryKey: ['system', 'metrics'],
    queryFn: () => apiClient.get('/system/metrics'),
    refetchInterval: 10000, // Refresh every 10s
  });

  // Use live metrics when available, fall back to query data
  const metrics = liveMetrics ?? data?.data;

  if (isLoading && !metrics) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Server Overview</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">Loading...</p>
        </CardContent>
      </Card>
    );
  }

  if (error && !metrics) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Server Overview</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-destructive">Failed to load metrics</p>
        </CardContent>
      </Card>
    );
  }

  if (!metrics) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Server Overview</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">No metrics available</p>
        </CardContent>
      </Card>
    );
  }

  const { cpu, memory, disk } = metrics;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Server Overview</CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-3 gap-4">
        <MetricCard label="CPU" value={cpu.usage.toFixed(1)} unit="%" />
        <MetricCard label="Memory" value={memory.usagePercent.toFixed(1)} unit="%" />
        <MetricCard label="Disk" value={disk.usagePercent.toFixed(1)} unit="%" />
      </CardContent>
    </Card>
  );
}

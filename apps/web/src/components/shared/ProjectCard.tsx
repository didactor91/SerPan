import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import type { PM2Process } from '@serverctrl/shared';
import { StatusBadge } from './StatusBadge';

interface ProjectCardProps {
  name: string;
  domain?: string;
  process: PM2Process;
}

export function ProjectCard({ name, domain, process }: ProjectCardProps) {
  const formatUptime = (ms: number): string => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ${hours % 24}h`;
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    return `${minutes}m`;
  };

  const formatMemory = (bytes: number): string => {
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(0)}MB`;
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">{name}</CardTitle>
          <StatusBadge status={process.status} />
        </div>
        {domain && <p className="text-sm text-muted-foreground">{domain}</p>}
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-3 gap-2 text-sm">
          <div>
            <p className="text-muted-foreground">CPU</p>
            <p className="font-medium">{process.cpu.toFixed(1)}%</p>
          </div>
          <div>
            <p className="text-muted-foreground">Memory</p>
            <p className="font-medium">{formatMemory(process.memory)}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Uptime</p>
            <p className="font-medium">{formatUptime(process.uptime)}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

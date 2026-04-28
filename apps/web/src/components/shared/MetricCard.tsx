import { Card, CardContent } from '@/components/ui/Card';

interface MetricCardProps {
  label: string;
  value: string | number;
  unit?: string;
  trend?: 'up' | 'down' | 'stable';
  icon?: React.ReactNode;
}

export function MetricCard({ label, value, unit, trend, icon }: MetricCardProps) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{label}</p>
            <p className="text-2xl font-bold mt-1">
              {value}
              {unit && (
                <span className="text-sm font-normal text-muted-foreground ml-1">{unit}</span>
              )}
            </p>
          </div>
          {icon && <div className="text-muted-foreground">{icon}</div>}
        </div>
        {trend && (
          <div className="mt-2">
            <span
              className={`text-xs ${
                trend === 'up'
                  ? 'text-red-500'
                  : trend === 'down'
                    ? 'text-green-500'
                    : 'text-muted-foreground'
              }`}
            >
              {trend === 'up' ? '↑' : trend === 'down' ? '↓' : '→'}
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

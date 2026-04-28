import type { ProcessStatus } from '@serverctrl/shared';

type Status = ProcessStatus;

const statusConfig: Record<Status, { label: string; classes: string }> = {
  online: { label: 'Online', classes: 'bg-green-100 text-green-800 border-green-200' },
  stopped: { label: 'Stopped', classes: 'bg-gray-100 text-gray-600 border-gray-200' },
  errored: { label: 'Error', classes: 'bg-red-100 text-red-800 border-red-200' },
  launching: { label: 'Starting', classes: 'bg-yellow-100 text-yellow-800 border-yellow-200' },
  unknown: { label: 'Unknown', classes: 'bg-gray-100 text-gray-500 border-gray-200' },
} as const;

interface StatusBadgeProps {
  status: Status;
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const config = statusConfig[status];

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${config.classes}`}
    >
      <span className="w-1.5 h-1.5 rounded-full mr-1.5 bg-current opacity-70" />
      {config.label}
    </span>
  );
}

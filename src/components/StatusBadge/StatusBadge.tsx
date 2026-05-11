import { TrackingStatus } from '../../types/tracking';

interface StatusBadgeProps {
  status: TrackingStatus;
}

const STATUS_CONFIG: Record<
  Exclude<TrackingStatus, TrackingStatus.IDLE>,
  { label: string; className: string }
> = {
  [TrackingStatus.LIVE]: { label: 'LIVE', className: 'live' },
  [TrackingStatus.DEAD_RECKONING]: { label: 'DEAD RECKONING', className: 'dead-reckoning' },
  [TrackingStatus.SIGNAL_LOST]: { label: 'SIGNAL LOST', className: 'signal-lost' },
};

export function StatusBadge({ status }: StatusBadgeProps) {
  if (status === TrackingStatus.IDLE) return null;
  const { label, className } = STATUS_CONFIG[status];
  return <span className={`status-badge ${className}`}>{label}</span>;
}

export enum TrackingStatus {
  IDLE = 'IDLE',
  LIVE = 'LIVE',
  DEAD_RECKONING = 'DEAD_RECKONING',
  SIGNAL_LOST = 'SIGNAL_LOST',
}

export interface TrackingState {
  status: TrackingStatus;
  lastPingTime: number | null;
}

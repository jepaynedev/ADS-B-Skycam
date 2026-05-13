export interface ExperimentalConfig {
  enabled: boolean;
  historyN: number; // last N API pings to use for turn-rate estimation (2–5)
  dynamicPolling: boolean;
  fixedPollMs: number; // poll interval used when !dynamicPolling
  minPollMs: number;
  maxPollMs: number;
  errorThresholdM: number; // error (m) at which poll rate reaches ~63% of max→min range
  showCameraTrail: boolean;
}

export const DEFAULT_EXPERIMENTAL_CONFIG: ExperimentalConfig = {
  enabled: false,
  historyN: 3,
  dynamicPolling: true,
  fixedPollMs: 30_000,
  minPollMs: 8_000,
  maxPollMs: 30_000,
  errorThresholdM: 150,
  showCameraTrail: false,
};

export interface ExperimentalMetrics {
  errorMag_m: number; // distance between camera and age-corrected truth at last ping
  turnRateDegSec: number; // weighted turn rate from recent API history
  pathProgress: number; // t/T of current camera path (>1 = coasting past end)
  pollSec: number; // poll interval assumed when planning current path
}

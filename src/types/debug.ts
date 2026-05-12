export interface ConvergenceMetrics {
  errorMag_m: number;
  halfLife_s: number;
  k_multiplier: number;
  trend: 'shrinking' | 'stable' | 'growing' | 'snap';
}

export type DebugEvent =
  | { id: number; timestamp: number; type: 'request'; icao24: string }
  | {
      id: number;
      timestamp: number;
      type: 'success';
      icao24: string;
      callsign: string;
      alt_m: number;
      speed_ms: number;
      heading: number;
      convergence?: ConvergenceMetrics;
    }
  | { id: number; timestamp: number; type: 'no_data'; icao24: string }
  | { id: number; timestamp: number; type: 'error'; icao24: string; message: string }
  | {
      id: number;
      timestamp: number;
      type: 'camera_move';
      lat: number;
      lng: number;
      alt_m: number;
      range: number;
    };

export type PollEvent =
  | { type: 'request'; icao24: string }
  | {
      type: 'success';
      icao24: string;
      callsign: string;
      alt_m: number;
      speed_ms: number;
      heading: number;
      convergence?: ConvergenceMetrics;
    }
  | { type: 'no_data'; icao24: string }
  | { type: 'error'; icao24: string; message: string };

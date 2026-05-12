export interface AircraftState {
  icao24: string;
  callsign: string | null;
  lat: number;
  lng: number;
  alt_m: number;
  heading: number;
  speed_ms: number;
  vertical_rate: number;
  timestamp: number;
}

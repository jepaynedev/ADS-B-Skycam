import type { AircraftState, RawStateVector } from '../types/aircraft';

export function parseStateVector(raw: RawStateVector): AircraftState | null {
  const lat = raw[6];
  const lng = raw[5];

  if (lat === null || lng === null) return null;

  const callsignRaw = raw[1];

  return {
    icao24: raw[0],
    callsign: callsignRaw !== null ? callsignRaw.trim() : null,
    lat,
    lng,
    alt_m: raw[13] ?? raw[7] ?? 0,
    heading: raw[10] ?? 0,
    speed_ms: raw[9] ?? 0,
    vertical_rate: raw[11] ?? 0,
    timestamp: raw[3] ?? raw[4],
  };
}

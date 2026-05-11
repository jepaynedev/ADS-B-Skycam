import { config } from '../config';
import type { AircraftState, RawStateVector } from '../types/aircraft';

const OPENSKY_BASE = config.openSkyBase;

export interface OpenSkyCredentials {
  username: string;
  password: string;
}

export interface AreaBounds {
  lamin: number;
  lomin: number;
  lamax: number;
  lomax: number;
}

export async function fetchAircraftByArea(
  bounds: AreaBounds,
  credentials?: OpenSkyCredentials,
): Promise<AircraftState[]> {
  const { lamin, lomin, lamax, lomax } = bounds;
  const url = `${OPENSKY_BASE}/states/all?lamin=${lamin}&lomin=${lomin}&lamax=${lamax}&lomax=${lomax}`;

  const headers: Record<string, string> = {};
  if (credentials) {
    const token = btoa(`${credentials.username}:${credentials.password}`);
    headers['Authorization'] = `Basic ${token}`;
  }

  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`OpenSky request failed: ${res.status}`);

  const data = (await res.json()) as { states?: RawStateVector[] };
  if (!data.states) return [];

  return data.states.map(parseStateVector).filter((a): a is AircraftState => a !== null);
}

export async function fetchAircraft(
  icao24: string,
  credentials?: OpenSkyCredentials,
): Promise<AircraftState | null> {
  const url = `${OPENSKY_BASE}/states/all?icao24=${icao24}`;

  const headers: Record<string, string> = {};
  if (credentials) {
    const token = btoa(`${credentials.username}:${credentials.password}`);
    headers['Authorization'] = `Basic ${token}`;
  }

  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`OpenSky request failed: ${res.status}`);

  const data = (await res.json()) as { states?: RawStateVector[] };
  if (!data.states || data.states.length === 0) return null;

  return parseStateVector(data.states[0]);
}

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

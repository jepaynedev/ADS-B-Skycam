import { config } from '../config';
import type { AircraftState } from '../types/aircraft';

const ADSB_LOL_BASE = config.adsbLolBase;

interface AdsbLolAircraft {
  hex: string;
  flight?: string;
  lat?: number;
  lon?: number;
  alt_baro?: number | 'ground';
  alt_geom?: number;
  gs?: number; // knots
  track?: number; // degrees
  baro_rate?: number; // feet per minute
}

interface AdsbLolResponse {
  ac: AdsbLolAircraft[];
  now: number;
  total: number;
}

export async function fetchAircraftAdsbLol(icao24: string): Promise<AircraftState | null> {
  const res = await fetch(`${ADSB_LOL_BASE}/icao/${icao24.toLowerCase()}`);
  if (!res.ok) throw new Error(`adsb.lol ${res.status}`);
  const json = (await res.json()) as AdsbLolResponse;
  const ac = json.ac?.[0];
  if (!ac || ac.lat == null || ac.lon == null) return null;

  const altFt =
    typeof ac.alt_geom === 'number'
      ? ac.alt_geom
      : typeof ac.alt_baro === 'number'
        ? ac.alt_baro
        : 0;

  return {
    icao24: ac.hex,
    callsign: (ac.flight ?? '').trim(),
    lat: ac.lat,
    lng: ac.lon,
    alt_m: altFt / 3.28084,
    heading: ac.track ?? 0,
    speed_ms: (ac.gs ?? 0) * 0.514444,
    vertical_rate: (ac.baro_rate ?? 0) * 0.00508,
    timestamp: Date.now(),
  };
}

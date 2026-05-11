import type { AircraftState } from '../types/aircraft';

const ADSB_BASE = 'https://adsbexchange-com1.p.rapidapi.com/v2/icao';
const ADSB_HOST = 'adsbexchange-com1.p.rapidapi.com';

interface AdsbAircraft {
  hex: string;
  flight?: string;
  lat: number;
  lon: number;
  alt_geom?: number;
  alt_baro?: number;
  gs?: number;
  track?: number;
  baro_rate?: number;
}

export async function fetchAircraftADSBX(
  icao24: string,
  apiKey: string,
): Promise<AircraftState | null> {
  const res = await fetch(`${ADSB_BASE}/${icao24}/`, {
    headers: {
      'X-RapidAPI-Key': apiKey,
      'X-RapidAPI-Host': ADSB_HOST,
    },
  });

  if (!res.ok) throw new Error(`ADS-B Exchange request failed: ${res.status}`);

  const data = (await res.json()) as { ac?: AdsbAircraft[] };
  if (!data.ac || data.ac.length === 0) return null;

  const ac = data.ac[0];
  const altFt = ac.alt_geom ?? ac.alt_baro ?? 0;

  return {
    icao24: ac.hex,
    callsign: ac.flight?.trim() ?? null,
    lat: ac.lat,
    lng: ac.lon,
    alt_m: altFt / 3.28084,
    heading: ac.track ?? 0,
    speed_ms: (ac.gs ?? 0) / 1.94384,
    vertical_rate: (ac.baro_rate ?? 0) / 196.85,
    timestamp: Date.now(),
  };
}

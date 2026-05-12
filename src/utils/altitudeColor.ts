export interface AltitudeBand {
  label: string;
  minAlt_m: number;
  color: string;
}

export const ALTITUDE_BANDS: AltitudeBand[] = [
  { label: '< 1.6k ft', minAlt_m: 0, color: '#dc2626' },
  { label: '1.6k–10k ft', minAlt_m: 500, color: '#f97316' },
  { label: '10k–23k ft', minAlt_m: 3000, color: '#eab308' },
  { label: '23k–36k ft', minAlt_m: 7000, color: '#22c55e' },
  { label: '36k+ ft', minAlt_m: 11000, color: '#3b82f6' },
];

export function altitudeToColor(alt_m: number): string {
  if (!isFinite(alt_m)) return ALTITUDE_BANDS[0].color;
  for (let i = ALTITUDE_BANDS.length - 1; i >= 0; i--) {
    if (alt_m >= ALTITUDE_BANDS[i].minAlt_m) return ALTITUDE_BANDS[i].color;
  }
  return ALTITUDE_BANDS[0].color;
}

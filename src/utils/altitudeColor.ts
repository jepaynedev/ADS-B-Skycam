// Altitude range for the color gradient (metres)
export const ALT_MIN_M = 0;
export const ALT_MAX_M = 12000; // ~39 000 ft ceiling

export interface AltTick {
  alt_m: number;
  label: string;
}

// Reference ticks for the gradient legend (low → high)
export const ALT_TICKS: AltTick[] = [
  { alt_m: 0, label: 'GND' },
  { alt_m: 500, label: '1.6k' },
  { alt_m: 3000, label: '10k' },
  { alt_m: 7000, label: '23k' },
  { alt_m: 11000, label: '36k ft' },
];

// CSS gradient string for the legend bar (top = high, bottom = low)
export const ALT_GRADIENT_CSS =
  'linear-gradient(to bottom, hsl(270,80%,55%), hsl(220,80%,55%), hsl(120,75%,45%), hsl(55,90%,50%), hsl(20,90%,55%), hsl(0,80%,50%))';

/**
 * Maps altitude in metres to an HSL colour string.
 * Red (hue 0°) at ground → violet (hue 270°) at cruise.
 */
export function altitudeToColor(alt_m: number): string {
  if (!isFinite(alt_m)) return 'hsl(0, 80%, 50%)';
  const t = Math.max(0, Math.min(1, (alt_m - ALT_MIN_M) / (ALT_MAX_M - ALT_MIN_M)));
  const hue = Math.round(t * 270);
  return `hsl(${hue}, 80%, 50%)`;
}

// Quantise altitude to the nearest step for trail segment grouping.
// Smaller step = more colour variation in trail, more polyline objects.
const TRAIL_STEP_M = 500;

export function quantiseAlt(alt_m: number): number {
  return Math.floor(Math.max(0, alt_m) / TRAIL_STEP_M) * TRAIL_STEP_M;
}

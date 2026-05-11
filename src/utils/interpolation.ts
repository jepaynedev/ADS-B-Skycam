import type { AircraftState } from '../types/aircraft';

export function lerpHeading(a: number, b: number, t: number): number {
  const delta = ((b - a + 540) % 360) - 180; // normalize to -180..180
  return (a + delta * t + 360) % 360;
}

export function interpolatePosition(last: AircraftState, elapsedSeconds: number): AircraftState {
  const R = 6371000; // Earth radius in meters
  const distance = last.speed_ms * elapsedSeconds;
  const headingRad = (last.heading * Math.PI) / 180;

  const dLat = (distance * Math.cos(headingRad)) / R;
  const dLng = (distance * Math.sin(headingRad)) / (R * Math.cos((last.lat * Math.PI) / 180));

  return {
    ...last,
    lat: last.lat + (dLat * 180) / Math.PI,
    lng: last.lng + (dLng * 180) / Math.PI,
    alt_m: last.alt_m + last.vertical_rate * elapsedSeconds,
  };
}

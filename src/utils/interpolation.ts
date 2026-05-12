import type { AircraftState } from '../types/aircraft';

export function lerpHeading(a: number, b: number, t: number): number {
  const delta = ((b - a + 540) % 360) - 180; // normalize to -180..180
  return (a + delta * t + 360) % 360;
}

export function haversineMeters(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const R = 6371000;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const sinDLat = Math.sin(dLat / 2);
  const sinDLng = Math.sin(dLng / 2);
  const aa = sinDLat * sinDLat + Math.cos(lat1) * Math.cos(lat2) * sinDLng * sinDLng;
  return 2 * R * Math.asin(Math.sqrt(aa));
}

export function signedHeadingDeltaDeg(to: number, from: number): number {
  return ((to - from + 540) % 360) - 180;
}

export function wrap360(deg: number): number {
  return ((deg % 360) + 360) % 360;
}

export function decayExp(value: number, dt: number, k: number): number {
  return value * Math.exp(-k * dt);
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

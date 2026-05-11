import type { AircraftState } from '../types/aircraft';
import { interpolatePosition, lerpHeading } from './interpolation';

describe('lerpHeading', () => {
  it('interpolates heading in the simple case', () => {
    expect(lerpHeading(0, 90, 0.5)).toBeCloseTo(45, 5);
  });

  it('wraps correctly from 350 to 10 (across north)', () => {
    // Shortest path: 350 → 360/0 → 10, delta = +20°
    expect(lerpHeading(350, 10, 0.5)).toBeCloseTo(0, 5);
  });

  it('wraps correctly from 10 to 350 (opposite direction)', () => {
    // Shortest path: 10 → 0/360 → 350, delta = -20°
    expect(lerpHeading(10, 350, 0.5)).toBeCloseTo(0, 5);
  });

  it('returns the same heading when a equals b', () => {
    expect(lerpHeading(180, 180, 0.5)).toBe(180);
  });

  it('returns a at t=0', () => {
    expect(lerpHeading(0, 180, 0)).toBeCloseTo(0, 5);
  });

  it('returns b at t=1', () => {
    expect(lerpHeading(0, 180, 1)).toBeCloseTo(180, 5);
  });

  it('handles 270 to 90 via shortest path (180° delta — goes either way)', () => {
    // 180° delta: result should be 0 or 180; just ensure it is in range
    const result = lerpHeading(270, 90, 0.5);
    expect(result).toBeGreaterThanOrEqual(0);
    expect(result).toBeLessThan(360);
  });

  it('result is always in [0, 360)', () => {
    expect(lerpHeading(355, 5, 0.5)).toBeGreaterThanOrEqual(0);
    expect(lerpHeading(355, 5, 0.5)).toBeLessThan(360);
  });
});

describe('interpolatePosition', () => {
  const base: AircraftState = {
    icao24: 'abc123',
    callsign: 'TEST1',
    lat: 0,
    lng: 0,
    alt_m: 10000,
    heading: 0,
    speed_ms: 100,
    vertical_rate: 0,
    timestamp: 1000,
  };

  it('heading 0° (north) increases latitude', () => {
    const result = interpolatePosition({ ...base, heading: 0 }, 10);
    expect(result.lat).toBeGreaterThan(0);
    expect(result.lng).toBeCloseTo(0, 5);
  });

  it('heading 90° (east) increases longitude', () => {
    const result = interpolatePosition({ ...base, heading: 90 }, 10);
    expect(result.lng).toBeGreaterThan(0);
    expect(result.lat).toBeCloseTo(0, 3);
  });

  it('heading 180° (south) decreases latitude', () => {
    const result = interpolatePosition({ ...base, heading: 180 }, 10);
    expect(result.lat).toBeLessThan(0);
    expect(result.lng).toBeCloseTo(0, 3);
  });

  it('zero speed leaves position unchanged', () => {
    const result = interpolatePosition({ ...base, speed_ms: 0 }, 10);
    expect(result.lat).toBe(0);
    expect(result.lng).toBe(0);
  });

  it('advances altitude by vertical_rate', () => {
    const result = interpolatePosition({ ...base, vertical_rate: 10 }, 5);
    expect(result.alt_m).toBeCloseTo(10050, 5);
  });

  it('descends altitude with negative vertical_rate', () => {
    const result = interpolatePosition({ ...base, vertical_rate: -5 }, 10);
    expect(result.alt_m).toBeCloseTo(9950, 5);
  });

  it('preserves heading, speed_ms, vertical_rate', () => {
    const result = interpolatePosition(
      { ...base, heading: 45, speed_ms: 200, vertical_rate: 3 },
      1,
    );
    expect(result.heading).toBe(45);
    expect(result.speed_ms).toBe(200);
    expect(result.vertical_rate).toBe(3);
  });
});

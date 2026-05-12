import type { AircraftState } from '../types/aircraft';
import {
  decayExp,
  haversineMeters,
  interpolatePosition,
  lerpHeading,
  signedHeadingDeltaDeg,
  wrap360,
} from './interpolation';

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

describe('haversineMeters', () => {
  it('returns 0 for identical points', () => {
    expect(haversineMeters({ lat: 0, lng: 0 }, { lat: 0, lng: 0 })).toBe(0);
  });

  it('returns ~111195 m per degree latitude at equator', () => {
    expect(haversineMeters({ lat: 0, lng: 0 }, { lat: 1, lng: 0 })).toBeCloseTo(111195, -1);
  });

  it('is symmetric', () => {
    const a = { lat: 51.5, lng: -0.1 };
    const b = { lat: 51.6, lng: 0.0 };
    expect(haversineMeters(a, b)).toBeCloseTo(haversineMeters(b, a), 5);
  });
});

describe('signedHeadingDeltaDeg', () => {
  it('handles simple forward delta', () => {
    expect(signedHeadingDeltaDeg(90, 60)).toBeCloseTo(30, 5);
  });

  it('wraps correctly across north: 10 from 350 = +20', () => {
    expect(signedHeadingDeltaDeg(10, 350)).toBeCloseTo(20, 5);
  });

  it('wraps correctly across north: 350 from 10 = -20', () => {
    expect(signedHeadingDeltaDeg(350, 10)).toBeCloseTo(-20, 5);
  });

  it('returns 0 for equal headings', () => {
    expect(signedHeadingDeltaDeg(180, 180)).toBe(0);
  });
});

describe('wrap360', () => {
  it('wraps negative values', () => {
    expect(wrap360(-10)).toBeCloseTo(350, 5);
  });

  it('wraps values over 360', () => {
    expect(wrap360(370)).toBeCloseTo(10, 5);
  });

  it('leaves in-range values unchanged', () => {
    expect(wrap360(180)).toBe(180);
    expect(wrap360(0)).toBe(0);
  });
});

describe('decayExp', () => {
  it('halves the value over one half-life', () => {
    expect(decayExp(100, 1, Math.LN2)).toBeCloseTo(50, 5);
  });

  it('returns the original value when dt is 0', () => {
    expect(decayExp(100, 0, Math.LN2)).toBe(100);
  });

  it('decays toward 0 monotonically', () => {
    const v0 = 100;
    const v1 = decayExp(v0, 1, 0.5);
    const v2 = decayExp(v1, 1, 0.5);
    expect(v1).toBeLessThan(v0);
    expect(v2).toBeLessThan(v1);
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

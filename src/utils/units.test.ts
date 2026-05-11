import { metersToFeet, msToKnots, msToFpm } from './units';

describe('metersToFeet', () => {
  it('converts 1 meter to feet', () => {
    expect(metersToFeet(1)).toBeCloseTo(3.28084, 4);
  });
  it('converts 0', () => {
    expect(metersToFeet(0)).toBe(0);
  });
  it('handles negative values (below sea level)', () => {
    expect(metersToFeet(-100)).toBeCloseTo(-328.084, 2);
  });
  it('converts 10000 meters (cruise altitude)', () => {
    expect(metersToFeet(10000)).toBeCloseTo(32808.4, 0);
  });
});

describe('msToKnots', () => {
  it('converts 1 m/s to knots', () => {
    expect(msToKnots(1)).toBeCloseTo(1.94384, 4);
  });
  it('converts 0', () => {
    expect(msToKnots(0)).toBe(0);
  });
  it('handles negative values (reverse/wind)', () => {
    expect(msToKnots(-10)).toBeCloseTo(-19.4384, 3);
  });
});

describe('msToFpm', () => {
  it('converts 1 m/s to feet per minute', () => {
    expect(msToFpm(1)).toBeCloseTo(196.85, 1);
  });
  it('converts 0', () => {
    expect(msToFpm(0)).toBe(0);
  });
  it('handles negative values (descent)', () => {
    expect(msToFpm(-5)).toBeCloseTo(-984.25, 1);
  });
});

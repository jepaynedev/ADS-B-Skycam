import { lerpHeading } from './interpolation';

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

import { altitudeToColor, quantiseAlt, ALT_MIN_M, ALT_MAX_M, ALT_TICKS } from './altitudeColor';

function parseHue(color: string): number {
  const m = /hsl\((\d+)/.exec(color);
  return m ? parseInt(m[1], 10) : -1;
}

describe('altitudeToColor', () => {
  it('returns red hue (0°) at ground level', () => {
    expect(parseHue(altitudeToColor(0))).toBe(0);
  });

  it('returns violet hue (270°) at max altitude', () => {
    expect(parseHue(altitudeToColor(ALT_MAX_M))).toBe(270);
  });

  it('returns ~135° (green-ish) at mid altitude', () => {
    const mid = (ALT_MIN_M + ALT_MAX_M) / 2;
    const hue = parseHue(altitudeToColor(mid));
    expect(hue).toBeGreaterThanOrEqual(130);
    expect(hue).toBeLessThanOrEqual(140);
  });

  it('clamps negative altitude to ground colour', () => {
    expect(altitudeToColor(-500)).toBe(altitudeToColor(0));
  });

  it('clamps above-max altitude to max colour', () => {
    expect(altitudeToColor(ALT_MAX_M + 5000)).toBe(altitudeToColor(ALT_MAX_M));
  });

  it('handles NaN gracefully', () => {
    const color = altitudeToColor(NaN);
    expect(typeof color).toBe('string');
    expect(color.startsWith('hsl(')).toBe(true);
  });

  it('handles Infinity gracefully', () => {
    const color = altitudeToColor(Infinity);
    expect(typeof color).toBe('string');
  });

  it('hue strictly increases with altitude', () => {
    const alts = [0, 1000, 3000, 6000, 9000, 12000];
    const hues = alts.map((a) => parseHue(altitudeToColor(a)));
    for (let i = 1; i < hues.length; i++) {
      expect(hues[i]).toBeGreaterThan(hues[i - 1]);
    }
  });
});

describe('quantiseAlt', () => {
  it('rounds down to nearest 500 m step', () => {
    expect(quantiseAlt(0)).toBe(0);
    expect(quantiseAlt(499)).toBe(0);
    expect(quantiseAlt(500)).toBe(500);
    expect(quantiseAlt(750)).toBe(500);
    expect(quantiseAlt(3001)).toBe(3000);
  });

  it('clamps negative altitude to 0', () => {
    expect(quantiseAlt(-100)).toBe(0);
  });
});

describe('ALT_TICKS', () => {
  it('is sorted low to high', () => {
    for (let i = 1; i < ALT_TICKS.length; i++) {
      expect(ALT_TICKS[i].alt_m).toBeGreaterThan(ALT_TICKS[i - 1].alt_m);
    }
  });
});

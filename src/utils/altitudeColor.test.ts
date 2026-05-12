import { altitudeToColor, ALTITUDE_BANDS } from './altitudeColor';

describe('altitudeToColor', () => {
  it('returns ground color for 0 m', () => {
    expect(altitudeToColor(0)).toBe(ALTITUDE_BANDS[0].color);
  });

  it('returns ground color for negative altitude', () => {
    expect(altitudeToColor(-100)).toBe(ALTITUDE_BANDS[0].color);
  });

  it('returns ground color for NaN', () => {
    expect(altitudeToColor(NaN)).toBe(ALTITUDE_BANDS[0].color);
  });

  it('returns ground color for Infinity', () => {
    expect(altitudeToColor(Infinity)).toBe(ALTITUDE_BANDS[0].color);
  });

  it('transitions to low band at 500 m', () => {
    expect(altitudeToColor(500)).toBe(ALTITUDE_BANDS[1].color);
    expect(altitudeToColor(499)).toBe(ALTITUDE_BANDS[0].color);
  });

  it('transitions to mid band at 3000 m', () => {
    expect(altitudeToColor(3000)).toBe(ALTITUDE_BANDS[2].color);
    expect(altitudeToColor(2999)).toBe(ALTITUDE_BANDS[1].color);
  });

  it('transitions to high band at 7000 m', () => {
    expect(altitudeToColor(7000)).toBe(ALTITUDE_BANDS[3].color);
    expect(altitudeToColor(6999)).toBe(ALTITUDE_BANDS[2].color);
  });

  it('returns cruise color at and above 11000 m', () => {
    expect(altitudeToColor(11000)).toBe(ALTITUDE_BANDS[4].color);
    expect(altitudeToColor(12000)).toBe(ALTITUDE_BANDS[4].color);
  });
});

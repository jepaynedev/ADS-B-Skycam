import type { RawStateVector } from '../types/aircraft';
import { parseStateVector } from './opensky';

function makeRaw(overrides: Partial<Record<number, unknown>> = {}): RawStateVector {
  const defaults: RawStateVector = [
    'abc123', // 0 icao24
    'UAL123 ', // 1 callsign (with trailing space)
    'United States', // 2 origin_country
    1000, // 3 time_position
    1000, // 4 last_contact
    -74.006, // 5 longitude
    40.7128, // 6 latitude
    9000, // 7 baro_altitude
    false, // 8 on_ground
    250, // 9 velocity
    90, // 10 true_track (heading)
    2, // 11 vertical_rate
    null, // 12 sensors
    9100, // 13 geo_altitude
    '1234', // 14 squawk
    false, // 15 spi
    0, // 16 position_source
  ];
  const result = [...defaults] as RawStateVector;
  for (const [idx, val] of Object.entries(overrides)) {
    (result as unknown[])[Number(idx)] = val;
  }
  return result;
}

describe('parseStateVector', () => {
  it('maps all fields correctly', () => {
    const raw = makeRaw();
    const aircraft = parseStateVector(raw);
    expect(aircraft).not.toBeNull();
    expect(aircraft!.icao24).toBe('abc123');
    expect(aircraft!.callsign).toBe('UAL123'); // trimmed
    expect(aircraft!.lat).toBe(40.7128);
    expect(aircraft!.lng).toBe(-74.006);
    expect(aircraft!.alt_m).toBe(9100); // prefers geo_altitude
    expect(aircraft!.heading).toBe(90);
    expect(aircraft!.speed_ms).toBe(250);
    expect(aircraft!.vertical_rate).toBe(2);
    expect(aircraft!.timestamp).toBe(1000);
  });

  it('prefers geo_altitude (field 13) over baro_altitude (field 7)', () => {
    const raw = makeRaw({ 7: 8000, 13: 9100 });
    expect(parseStateVector(raw)!.alt_m).toBe(9100);
  });

  it('falls back to baro_altitude when geo_altitude is null', () => {
    const raw = makeRaw({ 7: 8000, 13: null });
    expect(parseStateVector(raw)!.alt_m).toBe(8000);
  });

  it('trims whitespace from callsign', () => {
    const raw = makeRaw({ 1: '  BAW456  ' });
    expect(parseStateVector(raw)!.callsign).toBe('BAW456');
  });

  it('returns null callsign when callsign field is null', () => {
    const raw = makeRaw({ 1: null });
    expect(parseStateVector(raw)!.callsign).toBeNull();
  });

  it('returns null when latitude is null (no position)', () => {
    const raw = makeRaw({ 6: null });
    expect(parseStateVector(raw)).toBeNull();
  });

  it('returns null when longitude is null (no position)', () => {
    const raw = makeRaw({ 5: null });
    expect(parseStateVector(raw)).toBeNull();
  });

  it('defaults heading to 0 when null', () => {
    const raw = makeRaw({ 10: null });
    expect(parseStateVector(raw)!.heading).toBe(0);
  });

  it('defaults speed_ms to 0 when null', () => {
    const raw = makeRaw({ 9: null });
    expect(parseStateVector(raw)!.speed_ms).toBe(0);
  });

  it('defaults vertical_rate to 0 when null', () => {
    const raw = makeRaw({ 11: null });
    expect(parseStateVector(raw)!.vertical_rate).toBe(0);
  });

  it('uses baro_altitude when both altitudes are null (returns 0)', () => {
    const raw = makeRaw({ 7: null, 13: null });
    expect(parseStateVector(raw)!.alt_m).toBe(0);
  });
});

import { fetchAircraftAdsbLol } from './adsbLol';

jest.mock('../config');

function mockFetch(body: unknown, ok = true) {
  globalThis.fetch = jest.fn().mockResolvedValue({
    ok,
    status: ok ? 200 : 500,
    json: () => Promise.resolve(body),
  });
}

afterEach(() => {
  jest.restoreAllMocks();
});

const AIRCRAFT_RESPONSE = {
  ac: [
    {
      hex: 'a1b2c3',
      flight: 'TST001  ',
      lat: 40.7,
      lon: -74.0,
      alt_geom: 32808,
      gs: 486,
      track: 90,
      baro_rate: 0,
    },
  ],
  now: 1000,
  total: 1,
};

describe('fetchAircraftAdsbLol', () => {
  it('requests the correct URL containing the lowercased ICAO24', async () => {
    mockFetch(AIRCRAFT_RESPONSE);
    await fetchAircraftAdsbLol('A1B2C3');
    const url = (globalThis.fetch as jest.Mock).mock.calls[0][0] as string;
    expect(url).toContain('a1b2c3');
  });

  it('returns an AircraftState with correct fields', async () => {
    mockFetch(AIRCRAFT_RESPONSE);
    const result = await fetchAircraftAdsbLol('a1b2c3');
    expect(result).not.toBeNull();
    expect(result!.icao24).toBe('a1b2c3');
    expect(result!.callsign).toBe('TST001');
    expect(result!.lat).toBe(40.7);
    expect(result!.lng).toBe(-74.0);
    expect(result!.heading).toBe(90);
  });

  it('converts altitude from feet to metres', async () => {
    mockFetch(AIRCRAFT_RESPONSE);
    const result = await fetchAircraftAdsbLol('a1b2c3');
    expect(result!.alt_m).toBeCloseTo(32808 / 3.28084, 0);
  });

  it('converts ground speed from knots to m/s', async () => {
    mockFetch(AIRCRAFT_RESPONSE);
    const result = await fetchAircraftAdsbLol('a1b2c3');
    expect(result!.speed_ms).toBeCloseTo(486 * 0.514444, 1);
  });

  it('converts vertical rate from fpm to m/s', async () => {
    mockFetch({ ac: [{ ...AIRCRAFT_RESPONSE.ac[0], baro_rate: 1000 }], now: 1000, total: 1 });
    const result = await fetchAircraftAdsbLol('a1b2c3');
    expect(result!.vertical_rate).toBeCloseTo(1000 * 0.00508, 4);
  });

  it('falls back to baro altitude when geometric altitude is absent', async () => {
    mockFetch({
      ac: [{ ...AIRCRAFT_RESPONSE.ac[0], alt_geom: undefined, alt_baro: 10000 }],
      now: 1000,
      total: 1,
    });
    const result = await fetchAircraftAdsbLol('a1b2c3');
    expect(result!.alt_m).toBeCloseTo(10000 / 3.28084, 0);
  });

  it('returns 0 altitude when both alt_geom and alt_baro are absent', async () => {
    mockFetch({
      ac: [{ ...AIRCRAFT_RESPONSE.ac[0], alt_geom: undefined, alt_baro: undefined }],
      now: 1000,
      total: 1,
    });
    const result = await fetchAircraftAdsbLol('a1b2c3');
    expect(result!.alt_m).toBe(0);
  });

  it('returns null when the ac array is empty', async () => {
    mockFetch({ ac: [], now: 1000, total: 0 });
    const result = await fetchAircraftAdsbLol('a1b2c3');
    expect(result).toBeNull();
  });

  it('returns null when lat is null', async () => {
    mockFetch({ ac: [{ ...AIRCRAFT_RESPONSE.ac[0], lat: null }], now: 1000, total: 1 });
    const result = await fetchAircraftAdsbLol('a1b2c3');
    expect(result).toBeNull();
  });

  it('returns null when lon is null', async () => {
    mockFetch({ ac: [{ ...AIRCRAFT_RESPONSE.ac[0], lon: null }], now: 1000, total: 1 });
    const result = await fetchAircraftAdsbLol('a1b2c3');
    expect(result).toBeNull();
  });

  it('throws on HTTP error response', async () => {
    mockFetch({}, false);
    await expect(fetchAircraftAdsbLol('a1b2c3')).rejects.toThrow();
  });

  it('re-throws network failures', async () => {
    globalThis.fetch = jest.fn().mockRejectedValue(new Error('Network error'));
    await expect(fetchAircraftAdsbLol('a1b2c3')).rejects.toThrow('Network error');
  });
});

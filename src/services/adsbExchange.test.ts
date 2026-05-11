import { fetchAircraftADSBX } from './adsbExchange';

const ADSB_API_KEY = 'test-adsb-key';

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
};

describe('fetchAircraftADSBX', () => {
  it('requests the correct URL for a given ICAO24', async () => {
    mockFetch(AIRCRAFT_RESPONSE);
    await fetchAircraftADSBX('a1b2c3', ADSB_API_KEY);
    const url = (globalThis.fetch as jest.Mock).mock.calls[0][0] as string;
    expect(url).toContain('a1b2c3');
  });

  it('sends the API key in the request headers', async () => {
    mockFetch(AIRCRAFT_RESPONSE);
    await fetchAircraftADSBX('a1b2c3', ADSB_API_KEY);
    const options = (globalThis.fetch as jest.Mock).mock.calls[0][1] as RequestInit;
    const headers = options.headers as Record<string, string>;
    expect(Object.values(headers).some((v) => v === ADSB_API_KEY)).toBe(true);
  });

  it('returns an AircraftState with correct fields', async () => {
    mockFetch(AIRCRAFT_RESPONSE);
    const result = await fetchAircraftADSBX('a1b2c3', ADSB_API_KEY);
    expect(result).not.toBeNull();
    expect(result!.icao24).toBe('a1b2c3');
    expect(result!.callsign).toBe('TST001');
    expect(result!.lat).toBe(40.7);
    expect(result!.lng).toBe(-74.0);
    expect(result!.heading).toBe(90);
  });

  it('converts altitude from feet to metres', async () => {
    mockFetch(AIRCRAFT_RESPONSE);
    const result = await fetchAircraftADSBX('a1b2c3', ADSB_API_KEY);
    expect(result!.alt_m).toBeCloseTo(32808 / 3.28084, 0);
  });

  it('converts ground speed from knots to m/s', async () => {
    mockFetch(AIRCRAFT_RESPONSE);
    const result = await fetchAircraftADSBX('a1b2c3', ADSB_API_KEY);
    expect(result!.speed_ms).toBeCloseTo(486 / 1.94384, 1);
  });

  it('converts vertical rate from fpm to m/s', async () => {
    mockFetch({
      ac: [{ ...AIRCRAFT_RESPONSE.ac[0], baro_rate: 1000 }],
    });
    const result = await fetchAircraftADSBX('a1b2c3', ADSB_API_KEY);
    expect(result!.vertical_rate).toBeCloseTo(1000 / 196.85, 2);
  });

  it('falls back to baro altitude when geometric altitude absent', async () => {
    mockFetch({
      ac: [{ ...AIRCRAFT_RESPONSE.ac[0], alt_geom: undefined, alt_baro: 10000 }],
    });
    const result = await fetchAircraftADSBX('a1b2c3', ADSB_API_KEY);
    expect(result!.alt_m).toBeCloseTo(10000 / 3.28084, 0);
  });

  it('returns null when no aircraft in response', async () => {
    mockFetch({ ac: [] });
    const result = await fetchAircraftADSBX('a1b2c3', ADSB_API_KEY);
    expect(result).toBeNull();
  });

  it('throws on HTTP error', async () => {
    mockFetch({}, false);
    await expect(fetchAircraftADSBX('a1b2c3', ADSB_API_KEY)).rejects.toThrow();
  });
});

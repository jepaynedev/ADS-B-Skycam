import type { RawStateVector } from '../types/aircraft';
import { fetchAircraft, fetchAircraftByArea, parseStateVector } from './opensky';

jest.mock('../config');

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

describe('fetchAircraft', () => {
  const validState = makeRaw();
  const mockResponse = (body: unknown, status = 200) =>
    Promise.resolve({
      ok: status >= 200 && status < 300,
      status,
      json: () => Promise.resolve(body),
    } as Response);

  let fetchMock: jest.Mock;

  beforeEach(() => {
    fetchMock = jest.fn().mockImplementation(() => mockResponse({ states: [validState] }));
    globalThis.fetch = fetchMock;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('returns AircraftState on success', async () => {
    const result = await fetchAircraft('abc123');
    expect(result).not.toBeNull();
    expect(result!.icao24).toBe('abc123');
  });

  it('constructs the correct URL with icao24', async () => {
    await fetchAircraft('abc123');
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('icao24=abc123'),
      expect.anything(),
    );
  });

  it('returns null when states array is empty', async () => {
    fetchMock.mockImplementation(() => mockResponse({ states: [] }));
    expect(await fetchAircraft('abc123')).toBeNull();
  });

  it('returns null when states field is absent', async () => {
    fetchMock.mockImplementation(() => mockResponse({}));
    expect(await fetchAircraft('abc123')).toBeNull();
  });

  it('throws on HTTP error response', async () => {
    fetchMock.mockImplementation(() => mockResponse('', 429));
    await expect(fetchAircraft('abc123')).rejects.toThrow('429');
  });

  it('re-throws network failures', async () => {
    fetchMock.mockRejectedValue(new Error('Network error'));
    await expect(fetchAircraft('abc123')).rejects.toThrow('Network error');
  });

  it('sends Basic Auth header when credentials provided', async () => {
    await fetchAircraft('abc123', { username: 'user', password: 'pass' });
    expect(fetchMock).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: expect.stringContaining('Basic ') }),
      }),
    );
  });

  it('does not send Authorization header when no credentials', async () => {
    await fetchAircraft('abc123');
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const headers = init?.headers as Record<string, string> | undefined;
    expect(headers?.Authorization).toBeUndefined();
  });
});

describe('fetchAircraftByArea', () => {
  const bounds = { lamin: 40, lomin: -75, lamax: 42, lomax: -73 };
  let fetchMock: jest.Mock;

  beforeEach(() => {
    fetchMock = jest.fn();
    globalThis.fetch = fetchMock;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('encodes bounding box params in the URL', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ states: [] }),
    });
    await fetchAircraftByArea(bounds);
    const [url] = fetchMock.mock.calls[0] as [string];
    expect(url).toContain('lamin=40');
    expect(url).toContain('lomin=-75');
    expect(url).toContain('lamax=42');
    expect(url).toContain('lomax=-73');
  });

  it('returns an array of AircraftState for multiple states', async () => {
    const raw1 = makeRaw({ 0: 'aaa111' });
    const raw2 = makeRaw({ 0: 'bbb222' });
    fetchMock.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ states: [raw1, raw2] }),
    });
    const results = await fetchAircraftByArea(bounds);
    expect(results).toHaveLength(2);
    expect(results[0].icao24).toBe('aaa111');
    expect(results[1].icao24).toBe('bbb222');
  });

  it('filters out states where parseStateVector returns null (no position)', async () => {
    const noPos = makeRaw({ 5: null, 6: null });
    const valid = makeRaw({ 0: 'ccc333' });
    fetchMock.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ states: [noPos, valid] }),
    });
    const results = await fetchAircraftByArea(bounds);
    expect(results).toHaveLength(1);
    expect(results[0].icao24).toBe('ccc333');
  });

  it('returns empty array when states is absent', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({}),
    });
    expect(await fetchAircraftByArea(bounds)).toEqual([]);
  });

  it('returns empty array when states is empty', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ states: [] }),
    });
    expect(await fetchAircraftByArea(bounds)).toEqual([]);
  });
});

import { act, renderHook } from '@testing-library/react';
import type { AircraftState } from '../types/aircraft';
import { TrackingStatus } from '../types/tracking';
import { useAircraftTracking } from './useAircraftTracking';

jest.mock('../services/opensky', () => ({
  fetchAircraft: jest.fn(),
}));

jest.mock('../services/adsbExchange', () => ({
  fetchAircraftADSBX: jest.fn(),
}));

import { fetchAircraft } from '../services/opensky';
import { fetchAircraftADSBX } from '../services/adsbExchange';
const mockFetchAircraft = fetchAircraft as jest.Mock;
const mockFetchADSBX = fetchAircraftADSBX as jest.Mock;

const validAircraft: AircraftState = {
  icao24: 'abc123',
  callsign: 'TEST1',
  lat: 40.7,
  lng: -74.0,
  alt_m: 10000,
  heading: 90,
  speed_ms: 250,
  vertical_rate: 0,
  timestamp: Date.now(),
};

describe('useAircraftTracking', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    mockFetchAircraft.mockResolvedValue(validAircraft);
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  it('starts in IDLE status with null aircraft', () => {
    const { result } = renderHook(() => useAircraftTracking());
    expect(result.current.status).toBe(TrackingStatus.IDLE);
    expect(result.current.aircraft).toBeNull();
  });

  it('fetches aircraft and sets LIVE status on startTracking', async () => {
    const { result } = renderHook(() => useAircraftTracking());
    await act(async () => {
      result.current.startTracking('abc123');
    });
    expect(result.current.status).toBe(TrackingStatus.LIVE);
    expect(result.current.aircraft).toEqual(validAircraft);
  });

  it('sets lastPingTime on successful fetch', async () => {
    const { result } = renderHook(() => useAircraftTracking());
    const before = Date.now();
    await act(async () => {
      result.current.startTracking('abc123');
    });
    expect(result.current.lastPingTime).toBeGreaterThanOrEqual(before);
  });

  it('polls again after refreshMs interval', async () => {
    const { result } = renderHook(() => useAircraftTracking({ refreshMs: 5000 }));
    await act(async () => {
      result.current.startTracking('abc123');
    });
    expect(mockFetchAircraft).toHaveBeenCalledTimes(1);
    await act(async () => {
      jest.advanceTimersByTime(5000);
    });
    expect(mockFetchAircraft).toHaveBeenCalledTimes(2);
  });

  it('stopTracking clears the interval', async () => {
    const { result } = renderHook(() => useAircraftTracking({ refreshMs: 5000 }));
    await act(async () => {
      result.current.startTracking('abc123');
    });
    act(() => result.current.stopTracking());
    await act(async () => {
      jest.advanceTimersByTime(10000);
    });
    expect(mockFetchAircraft).toHaveBeenCalledTimes(1);
  });

  it('sets SIGNAL_LOST status after 60s with no data', async () => {
    mockFetchAircraft.mockResolvedValue(null);
    const { result } = renderHook(() => useAircraftTracking({ refreshMs: 5000 }));
    await act(async () => {
      result.current.startTracking('abc123');
    });
    await act(async () => {
      jest.advanceTimersByTime(60000);
    });
    expect(result.current.status).toBe(TrackingStatus.SIGNAL_LOST);
  });

  it('returns to IDLE on stopTracking', async () => {
    const { result } = renderHook(() => useAircraftTracking());
    await act(async () => {
      result.current.startTracking('abc123');
    });
    act(() => result.current.stopTracking());
    expect(result.current.status).toBe(TrackingStatus.IDLE);
  });

  it('uses ADS-B Exchange when apiKey is provided', async () => {
    mockFetchADSBX.mockResolvedValue(validAircraft);
    const { result } = renderHook(() => useAircraftTracking({ adsbExchangeApiKey: 'test-key' }));
    await act(async () => {
      result.current.startTracking('abc123');
    });
    expect(mockFetchADSBX).toHaveBeenCalledWith('abc123', 'test-key');
    expect(mockFetchAircraft).not.toHaveBeenCalled();
    expect(result.current.status).toBe(TrackingStatus.LIVE);
  });

  it('falls back to OpenSky when no ADS-B Exchange key', async () => {
    const { result } = renderHook(() => useAircraftTracking());
    await act(async () => {
      result.current.startTracking('abc123');
    });
    expect(mockFetchADSBX).not.toHaveBeenCalled();
    expect(mockFetchAircraft).toHaveBeenCalled();
  });

  it('falls back to OpenSky when ADS-B Exchange throws', async () => {
    mockFetchADSBX.mockRejectedValue(new Error('ADSBX error'));
    const { result } = renderHook(() => useAircraftTracking({ adsbExchangeApiKey: 'test-key' }));
    await act(async () => {
      result.current.startTracking('abc123');
    });
    expect(mockFetchAircraft).toHaveBeenCalled();
    expect(result.current.status).toBe(TrackingStatus.LIVE);
  });
});

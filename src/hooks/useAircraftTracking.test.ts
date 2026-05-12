import { act, renderHook } from '@testing-library/react';
import type { AircraftState } from '../types/aircraft';
import { TrackingStatus } from '../types/tracking';
import { useAircraftTracking } from './useAircraftTracking';

jest.mock('../services/adsbLol', () => ({
  fetchAircraftAdsbLol: jest.fn(),
}));

import { fetchAircraftAdsbLol } from '../services/adsbLol';
const mockFetch = fetchAircraftAdsbLol as jest.Mock;

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
    mockFetch.mockResolvedValue(validAircraft);
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
    expect(mockFetch).toHaveBeenCalledTimes(1);
    await act(async () => {
      jest.advanceTimersByTime(5000);
    });
    expect(mockFetch).toHaveBeenCalledTimes(2);
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
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('sets SIGNAL_LOST status after 60s with no data', async () => {
    mockFetch.mockResolvedValue(null);
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

  it('stays IDLE (not SIGNAL_LOST) when the very first fetch fails', async () => {
    mockFetch.mockRejectedValue(new Error('CORS'));
    const { result } = renderHook(() => useAircraftTracking());
    await act(async () => {
      result.current.startTracking('abc123');
    });
    expect(result.current.status).toBe(TrackingStatus.IDLE);
  });

  it('stays IDLE (not SIGNAL_LOST) when the very first fetch returns null', async () => {
    mockFetch.mockResolvedValue(null);
    const { result } = renderHook(() => useAircraftTracking());
    await act(async () => {
      result.current.startTracking('abc123');
    });
    expect(result.current.status).toBe(TrackingStatus.IDLE);
  });
});

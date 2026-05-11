import { act, renderHook } from '@testing-library/react';
import type { AircraftState } from '../types/aircraft';
import { TrackingStatus } from '../types/tracking';
import { useInterpolation } from './useInterpolation';

const baseAircraft: AircraftState = {
  icao24: 'abc123',
  callsign: 'TEST1',
  lat: 40.0,
  lng: -74.0,
  alt_m: 10000,
  heading: 0,
  speed_ms: 100,
  vertical_rate: 0,
  timestamp: Date.now(),
};

describe('useInterpolation', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('returns null when aircraft is null', () => {
    const { result } = renderHook(() => useInterpolation(null, TrackingStatus.IDLE));
    expect(result.current).toBeNull();
  });

  it('returns the aircraft position when first set', () => {
    const { result } = renderHook(() => useInterpolation(baseAircraft, TrackingStatus.LIVE));
    expect(result.current).not.toBeNull();
    expect(result.current!.icao24).toBe('abc123');
  });

  it('advances latitude over elapsed time (heading north, speed 100 m/s)', () => {
    const { result, rerender } = renderHook(
      ({ aircraft, status }: { aircraft: AircraftState | null; status: TrackingStatus }) =>
        useInterpolation(aircraft, status),
      { initialProps: { aircraft: baseAircraft, status: TrackingStatus.LIVE } },
    );

    const initialLat = result.current?.lat ?? 0;

    act(() => {
      jest.advanceTimersByTime(5000); // 5 seconds elapsed
    });

    rerender({ aircraft: baseAircraft, status: TrackingStatus.LIVE });
    expect(result.current!.lat).toBeGreaterThan(initialLat);
  });

  it('does not advance position when SIGNAL_LOST', () => {
    const { result, rerender } = renderHook(
      ({ aircraft, status }: { aircraft: AircraftState | null; status: TrackingStatus }) =>
        useInterpolation(aircraft, status),
      { initialProps: { aircraft: baseAircraft, status: TrackingStatus.LIVE } },
    );

    const latAfterLive = result.current?.lat ?? 0;

    // Switch to SIGNAL_LOST
    rerender({ aircraft: baseAircraft, status: TrackingStatus.SIGNAL_LOST });
    act(() => {
      jest.advanceTimersByTime(10000);
    });
    rerender({ aircraft: baseAircraft, status: TrackingStatus.SIGNAL_LOST });

    // Position should not advance beyond what it was at signal lost
    expect(result.current!.lat).toBeCloseTo(latAfterLive, 4);
  });
});

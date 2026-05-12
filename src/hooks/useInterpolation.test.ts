import { act, renderHook } from '@testing-library/react';
import type { AircraftState } from '../types/aircraft';
import type { ConvergenceMetrics } from '../types/debug';
import { TrackingStatus } from '../types/tracking';
import { useInterpolation } from './useInterpolation';

function makeAircraft(overrides: Partial<AircraftState> = {}): AircraftState {
  return {
    icao24: 'abc123',
    callsign: 'TEST1',
    lat: 40.0,
    lng: -74.0,
    alt_m: 10000,
    heading: 0,
    speed_ms: 100,
    vertical_rate: 0,
    timestamp: Date.now(),
    ...overrides,
  };
}

// Offset lat by ~200 m north (1 deg lat ≈ 111195 m)
const LAT_200M = 200 / 111195;

describe('useInterpolation', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('returns null when aircraft is null', () => {
    const { result } = renderHook(() => useInterpolation(null, TrackingStatus.IDLE));
    expect(result.current).toBeNull();
  });

  it('returns the aircraft position when first set', () => {
    const aircraft = makeAircraft();
    const { result } = renderHook(() => useInterpolation(aircraft, TrackingStatus.LIVE));
    expect(result.current).not.toBeNull();
    expect(result.current!.icao24).toBe('abc123');
  });

  it('advances latitude over elapsed time (heading north, speed 100 m/s)', () => {
    const aircraft = makeAircraft();
    const { result, rerender } = renderHook(
      ({ ac, st }: { ac: AircraftState | null; st: TrackingStatus }) => useInterpolation(ac, st),
      { initialProps: { ac: aircraft, st: TrackingStatus.LIVE } },
    );

    const initialLat = result.current?.lat ?? 0;

    act(() => {
      jest.advanceTimersByTime(5000);
    });

    rerender({ ac: aircraft, st: TrackingStatus.LIVE });
    expect(result.current!.lat).toBeGreaterThan(initialLat);
  });

  it('does not advance position when SIGNAL_LOST', () => {
    const aircraft = makeAircraft();
    const { result, rerender } = renderHook(
      ({ ac, st }: { ac: AircraftState | null; st: TrackingStatus }) => useInterpolation(ac, st),
      { initialProps: { ac: aircraft, st: TrackingStatus.LIVE } },
    );

    const latAfterLive = result.current?.lat ?? 0;

    rerender({ ac: aircraft, st: TrackingStatus.SIGNAL_LOST });
    act(() => {
      jest.advanceTimersByTime(10000);
    });
    rerender({ ac: aircraft, st: TrackingStatus.SIGNAL_LOST });

    expect(result.current!.lat).toBeCloseTo(latAfterLive, 4);
  });

  it('does not jump on authoritative ping — displayed stays continuous', () => {
    const stateA = makeAircraft({ heading: 90, speed_ms: 200 });
    const { result, rerender } = renderHook(
      ({ ac, st }: { ac: AircraftState | null; st: TrackingStatus }) =>
        useInterpolation(ac, st, 10),
      { initialProps: { ac: stateA, st: TrackingStatus.LIVE } },
    );

    // Let a few rAF frames fire so displayedRef is populated
    act(() => {
      jest.advanceTimersByTime(80);
    });

    const beforePingLat = result.current!.lat;
    const beforePingLng = result.current!.lng;

    // New ping arrives 200 m north of current dead-reckoned position
    const stateB = makeAircraft({
      lat: stateA.lat + LAT_200M,
      heading: 90,
      speed_ms: 200,
      timestamp: Date.now(),
    });

    act(() => {
      rerender({ ac: stateB, st: TrackingStatus.LIVE });
      jest.advanceTimersByTime(16);
    });

    const afterPingLat = result.current!.lat;
    const afterPingLng = result.current!.lng;

    // Should be much closer to beforePing than to the 200 m jump
    expect(Math.abs(afterPingLat - beforePingLat)).toBeLessThan(LAT_200M * 0.1);
    expect(Math.abs(afterPingLng - beforePingLng)).toBeLessThan(0.0001);
  });

  it('hard-snaps and reports snap trend when error exceeds threshold', () => {
    const stateA = makeAircraft({ speed_ms: 100 });
    const convergenceEvents: ConvergenceMetrics[] = [];

    const { rerender } = renderHook(
      ({ ac, st }: { ac: AircraftState | null; st: TrackingStatus }) =>
        useInterpolation(ac, st, 10, (m) => convergenceEvents.push(m)),
      { initialProps: { ac: stateA, st: TrackingStatus.LIVE } },
    );

    act(() => {
      jest.advanceTimersByTime(80);
    });

    // 50 km jump — far beyond the hard-snap threshold of max(1500, 1.5*100*10)=1500
    const stateFar = makeAircraft({ lat: stateA.lat + 50000 / 111195, timestamp: Date.now() });

    act(() => {
      rerender({ ac: stateFar, st: TrackingStatus.LIVE });
    });

    expect(convergenceEvents.at(-1)?.trend).toBe('snap');
  });

  it('adaptive multiplier rises when errors trend upward', () => {
    const convergenceEvents: ConvergenceMetrics[] = [];
    let currentAc = makeAircraft({ speed_ms: 100 });

    const { rerender } = renderHook(
      ({ ac, st }: { ac: AircraftState | null; st: TrackingStatus }) =>
        useInterpolation(ac, st, 10, (m) => convergenceEvents.push(m)),
      { initialProps: { ac: currentAc, st: TrackingStatus.LIVE } },
    );

    act(() => {
      jest.advanceTimersByTime(80);
    });

    // Feed 4 pings with strictly growing error magnitudes
    const offsets = [50, 100, 150, 200];
    for (const offsetM of offsets) {
      currentAc = makeAircraft({
        lat: currentAc.lat + offsetM / 111195,
        speed_ms: 100,
        timestamp: Date.now(),
      });
      act(() => {
        rerender({ ac: currentAc, st: TrackingStatus.LIVE });
        jest.advanceTimersByTime(80);
      });
    }

    const last = convergenceEvents.at(-1);
    expect(last?.k_multiplier).toBeGreaterThan(1);
    expect(last?.trend).toBe('growing');
  });

  it('half-life scales with pollIntervalSec', () => {
    const stateA = makeAircraft({ speed_ms: 100 });
    const events10: ConvergenceMetrics[] = [];
    const events60: ConvergenceMetrics[] = [];

    // Poll interval 10 s
    const { rerender: rerender10 } = renderHook(
      ({ ac, st }: { ac: AircraftState | null; st: TrackingStatus }) =>
        useInterpolation(ac, st, 10, (m) => events10.push(m)),
      { initialProps: { ac: stateA, st: TrackingStatus.LIVE } },
    );
    act(() => {
      jest.advanceTimersByTime(80);
    });
    const stateB10 = makeAircraft({ lat: stateA.lat + 100 / 111195, timestamp: Date.now() });
    act(() => {
      rerender10({ ac: stateB10, st: TrackingStatus.LIVE });
    });

    // Poll interval 60 s
    const { rerender: rerender60 } = renderHook(
      ({ ac, st }: { ac: AircraftState | null; st: TrackingStatus }) =>
        useInterpolation(ac, st, 60, (m) => events60.push(m)),
      { initialProps: { ac: stateA, st: TrackingStatus.LIVE } },
    );
    act(() => {
      jest.advanceTimersByTime(80);
    });
    const stateB60 = makeAircraft({ lat: stateA.lat + 100 / 111195, timestamp: Date.now() });
    act(() => {
      rerender60({ ac: stateB60, st: TrackingStatus.LIVE });
    });

    const hl10 = events10.at(-1)?.halfLife_s ?? 0;
    const hl60 = events60.at(-1)?.halfLife_s ?? 0;
    expect(hl60 / hl10).toBeCloseTo(6, 1);
  });
});

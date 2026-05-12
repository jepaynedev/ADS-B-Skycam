import { renderHook, act } from '@testing-library/react';
import { useTrackHistory } from './useTrackHistory';
import type { AircraftState } from '../types/aircraft';

function makeAircraft(partial: Partial<AircraftState> = {}): AircraftState {
  return {
    icao24: 'abc123',
    callsign: 'TEST',
    lat: 40.0,
    lng: -90.0,
    alt_m: 1000,
    heading: 90,
    speed_ms: 100,
    vertical_rate: 0,
    timestamp: Date.now(),
    ...partial,
  };
}

describe('useTrackHistory', () => {
  it('starts empty when aircraft is null', () => {
    const { result } = renderHook(() => useTrackHistory(null));
    expect(result.current.history).toEqual([]);
  });

  it('adds first point when aircraft appears', () => {
    const ac = makeAircraft();
    const { result } = renderHook(({ ac }) => useTrackHistory(ac), {
      initialProps: { ac: ac as AircraftState | null },
    });
    expect(result.current.history).toHaveLength(1);
    expect(result.current.history[0]).toMatchObject({ lat: 40.0, lng: -90.0 });
  });

  it('does not add a point when movement is below min spacing', () => {
    const ac = makeAircraft();
    const { result, rerender } = renderHook(({ ac }) => useTrackHistory(ac), {
      initialProps: { ac: ac as AircraftState | null },
    });
    expect(result.current.history).toHaveLength(1);
    // ~10 m north — well below the 50 m threshold
    rerender({ ac: makeAircraft({ lat: 40.00009 }) });
    expect(result.current.history).toHaveLength(1);
  });

  it('adds a new point when movement exceeds min spacing', () => {
    const ac = makeAircraft();
    const { result, rerender } = renderHook(({ ac }) => useTrackHistory(ac), {
      initialProps: { ac: ac as AircraftState | null },
    });
    // ~500 m north — well above the 50 m threshold
    rerender({ ac: makeAircraft({ lat: 40.0045 }) });
    expect(result.current.history).toHaveLength(2);
  });

  it('resets history when aircraft becomes null', () => {
    const ac = makeAircraft();
    const { result, rerender } = renderHook(({ ac }) => useTrackHistory(ac), {
      initialProps: { ac: ac as AircraftState | null },
    });
    expect(result.current.history).toHaveLength(1);
    rerender({ ac: null });
    expect(result.current.history).toHaveLength(0);
  });

  it('resets history when icao24 changes', () => {
    const ac1 = makeAircraft({ icao24: 'abc123' });
    const { result, rerender } = renderHook(({ ac }) => useTrackHistory(ac), {
      initialProps: { ac: ac1 as AircraftState | null },
    });
    const ac2 = makeAircraft({ icao24: 'def456', lat: 50.0 });
    rerender({ ac: ac2 });
    expect(result.current.history).toHaveLength(1);
    expect(result.current.history[0]).toMatchObject({ lat: 50.0 });
  });

  it('clearHistory empties the buffer', () => {
    const { result, rerender } = renderHook(({ ac }) => useTrackHistory(ac), {
      initialProps: { ac: makeAircraft() as AircraftState | null },
    });
    rerender({ ac: makeAircraft({ lat: 40.0045 }) });
    expect(result.current.history).toHaveLength(2);
    act(() => {
      result.current.clearHistory();
    });
    expect(result.current.history).toHaveLength(0);
  });
});

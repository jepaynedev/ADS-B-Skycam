import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { AircraftState } from '../types/aircraft';
import { TrackingStatus } from '../types/tracking';
import { interpolatePosition } from '../utils/interpolation';

export function useInterpolation(
  aircraft: AircraftState | null,
  status: TrackingStatus,
): AircraftState | null {
  const [interpolated, setInterpolated] = useState<AircraftState | null>(aircraft);
  const aircraftRef = useRef(aircraft);
  const statusRef = useRef(status);
  const lastTimeRef = useRef<number | null>(null);

  // Sync latest props into refs after each render (not during render)
  useLayoutEffect(() => {
    const changed = aircraftRef.current !== aircraft;
    aircraftRef.current = aircraft;
    statusRef.current = status;
    if (changed) {
      lastTimeRef.current = null; // reset timing when aircraft data changes
    }
  }, [aircraft, status]);

  // rAF loop — all setState calls live inside the rAF callback, not in the effect body
  useEffect(() => {
    let rafId: number;

    const tick = (now: number) => {
      const a = aircraftRef.current;
      const s = statusRef.current;
      const lastTime = lastTimeRef.current;

      if (a && s !== TrackingStatus.SIGNAL_LOST) {
        if (lastTime !== null) {
          const elapsed = (now - lastTime) / 1000;
          setInterpolated((prev) => (prev ? interpolatePosition(prev, elapsed) : a));
        } else {
          setInterpolated(a);
        }
        lastTimeRef.current = now;
      } else {
        setInterpolated(a); // propagates null when aircraft is null
      }

      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, []);

  return interpolated;
}

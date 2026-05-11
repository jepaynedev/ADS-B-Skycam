import { useCallback, useRef, useState } from 'react';
import type { OpenSkyCredentials } from '../services/opensky';
import { fetchAircraft } from '../services/opensky';
import type { AircraftState } from '../types/aircraft';
import { TrackingStatus } from '../types/tracking';

const SIGNAL_LOST_MS = 60_000;
const DEFAULT_REFRESH_MS = 10_000;

interface UseAircraftTrackingOptions {
  refreshMs?: number;
  credentials?: OpenSkyCredentials;
}

export function useAircraftTracking(opts: UseAircraftTrackingOptions = {}) {
  const { refreshMs = DEFAULT_REFRESH_MS, credentials } = opts;

  const [aircraft, setAircraft] = useState<AircraftState | null>(null);
  const [status, setStatus] = useState<TrackingStatus>(TrackingStatus.IDLE);
  const [lastPingTime, setLastPingTime] = useState<number | null>(null);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastPingRef = useRef<number | null>(null);
  const icao24Ref = useRef<string | null>(null);

  const poll = useCallback(async () => {
    const icao24 = icao24Ref.current;
    if (!icao24) return;

    try {
      const data = await fetchAircraft(icao24, credentials);
      if (data) {
        setAircraft(data);
        setStatus(TrackingStatus.LIVE);
        const now = Date.now();
        lastPingRef.current = now;
        setLastPingTime(now);
      } else {
        const elapsed = lastPingRef.current ? Date.now() - lastPingRef.current : SIGNAL_LOST_MS;
        if (elapsed >= SIGNAL_LOST_MS) {
          setStatus(TrackingStatus.SIGNAL_LOST);
        } else {
          setStatus(TrackingStatus.DEAD_RECKONING);
        }
      }
    } catch {
      const elapsed = lastPingRef.current ? Date.now() - lastPingRef.current : SIGNAL_LOST_MS;
      if (elapsed >= SIGNAL_LOST_MS) {
        setStatus(TrackingStatus.SIGNAL_LOST);
      }
    }
  }, [credentials]);

  const startTracking = useCallback(
    async (icao24: string) => {
      icao24Ref.current = icao24;
      lastPingRef.current = null;

      if (intervalRef.current) clearInterval(intervalRef.current);

      await poll();

      intervalRef.current = setInterval(() => {
        void poll();
      }, refreshMs);
    },
    [poll, refreshMs],
  );

  const stopTracking = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    icao24Ref.current = null;
    setStatus(TrackingStatus.IDLE);
    setAircraft(null);
    setLastPingTime(null);
  }, []);

  return { aircraft, status, lastPingTime, startTracking, stopTracking };
}

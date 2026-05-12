import { useCallback, useEffect, useRef, useState } from 'react';
import type { AircraftState } from '../types/aircraft';
import { TrackingStatus } from '../types/tracking';
import type { PollEvent } from '../types/debug';
import { fetchAircraftAdsbLol } from '@/services/adsbLol';

const SIGNAL_LOST_MS = 60_000;
const DEFAULT_REFRESH_MS = 10_000;

interface UseAircraftTrackingOptions {
  refreshMs?: number;
  onPollEvent?: (event: PollEvent) => void;
}

export function useAircraftTracking(opts: UseAircraftTrackingOptions = {}) {
  const { refreshMs = DEFAULT_REFRESH_MS, onPollEvent } = opts;

  const [aircraft, setAircraft] = useState<AircraftState | null>(null);
  const [status, setStatus] = useState<TrackingStatus>(TrackingStatus.IDLE);
  const [lastPingTime, setLastPingTime] = useState<number | null>(null);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastPingRef = useRef<number | null>(null);
  const trackingStartRef = useRef<number | null>(null);
  const icao24Ref = useRef<string | null>(null);
  const onPollEventRef = useRef(onPollEvent);
  useEffect(() => {
    onPollEventRef.current = onPollEvent;
  });

  const poll = useCallback(async () => {
    const icao24 = icao24Ref.current;
    if (!icao24) return;

    onPollEventRef.current?.({ type: 'request', icao24 });

    try {
      const data: AircraftState | null = await fetchAircraftAdsbLol(icao24);
      if (data) {
        onPollEventRef.current?.({
          type: 'success',
          icao24,
          callsign: data.callsign ?? '',
          alt_m: data.alt_m,
          speed_ms: data.speed_ms,
          heading: data.heading,
        });
        setAircraft(data);
        setStatus(TrackingStatus.LIVE);
        const now = Date.now();
        lastPingRef.current = now;
        setLastPingTime(now);
      } else {
        onPollEventRef.current?.({ type: 'no_data', icao24 });
        // Use last-ping time if we've had one; fall back to tracking-start time.
        // This prevents immediately jumping to SIGNAL_LOST on the very first
        // failed fetch (e.g. CORS error or aircraft not yet broadcasting).
        const refTime = lastPingRef.current ?? trackingStartRef.current!;
        const elapsed = Date.now() - refTime;
        if (elapsed >= SIGNAL_LOST_MS) {
          setStatus(TrackingStatus.SIGNAL_LOST);
        } else if (lastPingRef.current !== null) {
          setStatus(TrackingStatus.DEAD_RECKONING);
        }
        // else: no successful ping yet and < 60s elapsed — keep current status
      }
    } catch (err) {
      onPollEventRef.current?.({
        type: 'error',
        icao24,
        message: err instanceof Error ? err.message : String(err),
      });
      const refTime = lastPingRef.current ?? trackingStartRef.current!;
      const elapsed = Date.now() - refTime;
      if (elapsed >= SIGNAL_LOST_MS) {
        setStatus(TrackingStatus.SIGNAL_LOST);
      }
    }
  }, []);

  const startTracking = useCallback(
    async (icao24: string) => {
      icao24Ref.current = icao24;
      lastPingRef.current = null;
      trackingStartRef.current = Date.now();

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
    trackingStartRef.current = null;
    setStatus(TrackingStatus.IDLE);
    setAircraft(null);
    setLastPingTime(null);
  }, []);

  return { aircraft, status, lastPingTime, startTracking, stopTracking };
}

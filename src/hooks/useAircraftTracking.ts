import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { AircraftState } from '../types/aircraft';
import { TrackingStatus } from '../types/tracking';
import type { PollEvent } from '../types/debug';
import { fetchAircraftAdsbLol } from '@/services/adsbLol';

const SIGNAL_LOST_MS = 60_000;
const DEFAULT_REFRESH_MS = 30_000;

interface UseAircraftTrackingOptions {
  /** Static refresh interval. Ignored if getRefreshMs is provided. */
  refreshMs?: number;
  /**
   * Dynamic refresh interval getter — called before each scheduled poll.
   * Takes precedence over refreshMs when provided.
   */
  getRefreshMs?: () => number;
  onPollEvent?: (event: PollEvent) => void;
}

export function useAircraftTracking(opts: UseAircraftTrackingOptions = {}) {
  const { refreshMs = DEFAULT_REFRESH_MS, getRefreshMs, onPollEvent } = opts;

  const [aircraft, setAircraft] = useState<AircraftState | null>(null);
  const [status, setStatus] = useState<TrackingStatus>(TrackingStatus.IDLE);
  const [lastPingTime, setLastPingTime] = useState<number | null>(null);

  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastPingRef = useRef<number | null>(null);
  const trackingStartRef = useRef<number | null>(null);
  const icao24Ref = useRef<string | null>(null);
  const onPollEventRef = useRef(onPollEvent);
  const refreshMsRef = useRef(refreshMs);
  const getRefreshMsRef = useRef(getRefreshMs);

  useEffect(() => {
    onPollEventRef.current = onPollEvent;
  });

  useEffect(() => {
    refreshMsRef.current = refreshMs;
  }, [refreshMs]);

  useEffect(() => {
    getRefreshMsRef.current = getRefreshMs;
  }, [getRefreshMs]);

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
        const refTime = lastPingRef.current ?? trackingStartRef.current!;
        const elapsed = Date.now() - refTime;
        if (elapsed >= SIGNAL_LOST_MS) {
          setStatus(TrackingStatus.SIGNAL_LOST);
        } else if (lastPingRef.current !== null) {
          setStatus(TrackingStatus.DEAD_RECKONING);
        }
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

  // Self-scheduling chain — reads the current refresh interval at each scheduling point.
  // scheduleNextRef breaks the recursive useCallback self-reference.
  const scheduleNextRef = useRef<() => void>(() => {});

  const scheduleNext = useCallback(() => {
    if (!icao24Ref.current) return;
    const delay = getRefreshMsRef.current?.() ?? refreshMsRef.current;
    timeoutRef.current = setTimeout(() => {
      void poll().then(() => {
        scheduleNextRef.current();
      });
    }, delay);
  }, [poll]);

  useLayoutEffect(() => {
    scheduleNextRef.current = scheduleNext;
  }, [scheduleNext]);

  const startTracking = useCallback(
    async (icao24: string) => {
      icao24Ref.current = icao24;
      lastPingRef.current = null;
      trackingStartRef.current = Date.now();

      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }

      await poll();
      scheduleNext();
    },
    [poll, scheduleNext],
  );

  const stopTracking = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    icao24Ref.current = null;
    trackingStartRef.current = null;
    setStatus(TrackingStatus.IDLE);
    setAircraft(null);
    setLastPingTime(null);
  }, []);

  return { aircraft, status, lastPingTime, startTracking, stopTracking, refreshMs };
}

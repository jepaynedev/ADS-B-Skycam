import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { AircraftState } from '../types/aircraft';
import type { ConvergenceMetrics } from '../types/debug';
import { TrackingStatus } from '../types/tracking';
import {
  decayExp,
  haversineMeters,
  interpolatePosition,
  signedHeadingDeltaDeg,
  wrap360,
} from '../utils/interpolation';

const SMOOTH_FRACTION = 0.15;
const HEADING_FRACTION = 0.06;
const AGGRESSIVE_MAX = 4;
const LOW_ERROR_M = 30;
const HARD_SNAP_M_FLOOR = 1500;
const HISTORY_N = 4;

type Residual = { dLat: number; dLng: number; dAlt: number; dHeadingDeg: number };

export function useInterpolation(
  aircraft: AircraftState | null,
  status: TrackingStatus,
  pollIntervalSec = 10,
  onConvergence?: (m: ConvergenceMetrics) => void,
): AircraftState | null {
  const [displayed, setDisplayed] = useState<AircraftState | null>(null);

  const latestAuthRef = useRef<AircraftState | null>(null);
  const displayedRef = useRef<AircraftState | null>(null);
  const residualRef = useRef<Residual>({ dLat: 0, dLng: 0, dAlt: 0, dHeadingDeg: 0 });
  const errorHistoryRef = useRef<number[]>([]);
  const kMultiplierRef = useRef<number>(1);
  const lastTickMsRef = useRef<number | null>(null);
  const pollIntervalSecRef = useRef<number>(pollIntervalSec);
  const statusRef = useRef<TrackingStatus>(status);
  const onConvergenceRef = useRef(onConvergence);

  useLayoutEffect(() => {
    onConvergenceRef.current = onConvergence;
    pollIntervalSecRef.current = pollIntervalSec;
    statusRef.current = status;

    if (aircraft === null || status === TrackingStatus.SIGNAL_LOST) {
      latestAuthRef.current = null;
      displayedRef.current = null;
      residualRef.current = { dLat: 0, dLng: 0, dAlt: 0, dHeadingDeg: 0 };
      errorHistoryRef.current = [];
      kMultiplierRef.current = 1;
      lastTickMsRef.current = null;
      return;
    }

    if (aircraft === latestAuthRef.current) return;

    const ageSec = Math.max(0, (Date.now() - aircraft.timestamp) / 1000);
    const newTruth = interpolatePosition(aircraft, ageSec);
    const oldDisplayed = displayedRef.current;

    latestAuthRef.current = aircraft;

    if (!oldDisplayed) return;

    const errorMag_m = haversineMeters(newTruth, oldDisplayed);
    const hardSnapThreshold = Math.max(
      HARD_SNAP_M_FLOOR,
      1.5 * aircraft.speed_ms * pollIntervalSecRef.current,
    );

    if (errorMag_m > hardSnapThreshold) {
      residualRef.current = { dLat: 0, dLng: 0, dAlt: 0, dHeadingDeg: 0 };
      errorHistoryRef.current = [];
      kMultiplierRef.current = 1;
      const halfLife_s = SMOOTH_FRACTION * pollIntervalSecRef.current;
      onConvergenceRef.current?.({ errorMag_m, halfLife_s, k_multiplier: 1, trend: 'snap' });
      return;
    }

    residualRef.current = {
      dLat: newTruth.lat - oldDisplayed.lat,
      dLng: newTruth.lng - oldDisplayed.lng,
      dAlt: newTruth.alt_m - oldDisplayed.alt_m,
      dHeadingDeg: signedHeadingDeltaDeg(newTruth.heading, oldDisplayed.heading),
    };

    const history = errorHistoryRef.current;
    history.push(errorMag_m);
    if (history.length > HISTORY_N) history.shift();

    let trend: ConvergenceMetrics['trend'] = 'stable';
    let multiplier = kMultiplierRef.current;

    if (history.length >= 2) {
      const rawTrend = (history[history.length - 1] - history[0]) / history.length;
      const mean = history.reduce((s, v) => s + v, 0) / history.length;

      if (rawTrend > 0.5) {
        trend = 'growing';
        multiplier = Math.min(AGGRESSIVE_MAX, 1 + rawTrend / LOW_ERROR_M);
      } else if (rawTrend < -0.5) {
        trend = 'shrinking';
        if (mean < LOW_ERROR_M) multiplier = 1;
      } else {
        trend = 'stable';
        if (mean < LOW_ERROR_M) multiplier = 1;
      }
    }

    kMultiplierRef.current = multiplier;
    const halfLife_s = (SMOOTH_FRACTION * pollIntervalSecRef.current) / multiplier;
    onConvergenceRef.current?.({ errorMag_m, halfLife_s, k_multiplier: multiplier, trend });
  }, [aircraft, status, pollIntervalSec, onConvergence]);

  useEffect(() => {
    let rafId: number;

    const tick = (now: number) => {
      const auth = latestAuthRef.current;
      const s = statusRef.current;

      if (!auth || s === TrackingStatus.SIGNAL_LOST) {
        setDisplayed(null);
        lastTickMsRef.current = null;
      } else {
        const last = lastTickMsRef.current;
        const dt = last == null ? 0 : (now - last) / 1000;
        lastTickMsRef.current = now;

        const poll = pollIntervalSecRef.current;
        const multiplier = kMultiplierRef.current;
        const kPos = (Math.LN2 / (SMOOTH_FRACTION * poll)) * multiplier;
        const kHdg = (Math.LN2 / (HEADING_FRACTION * poll)) * multiplier;

        const r = residualRef.current;
        if (dt > 0) {
          r.dLat = decayExp(r.dLat, dt, kPos);
          r.dLng = decayExp(r.dLng, dt, kPos);
          r.dAlt = decayExp(r.dAlt, dt, kPos);
          r.dHeadingDeg = decayExp(r.dHeadingDeg, dt, kHdg);
        }

        const ageSec = Math.max(0, (Date.now() - auth.timestamp) / 1000);
        const truth = interpolatePosition(auth, ageSec);
        const next: AircraftState = {
          ...truth,
          lat: truth.lat - r.dLat,
          lng: truth.lng - r.dLng,
          alt_m: truth.alt_m - r.dAlt,
          heading: wrap360(truth.heading - r.dHeadingDeg),
        };
        displayedRef.current = next;
        setDisplayed(next);
      }

      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, []);

  return displayed ?? aircraft;
}

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { AircraftState } from '../types/aircraft';
import type { ConvergenceMetrics } from '../types/debug';
import type { ExperimentalConfig, ExperimentalMetrics } from '../types/experimental';
import { TrackingStatus } from '../types/tracking';
import {
  decayExp,
  haversineMeters,
  interpolatePosition,
  signedHeadingDeltaDeg,
  wrap360,
} from '../utils/interpolation';
import {
  arcDeadReckon,
  bootstrapCameraPath,
  evalCameraPath,
  planCameraPath,
  velocityENU,
  weightedTurnRate,
} from '../utils/pathPlanning';
import type { CameraPath, CameraEval } from '../utils/pathPlanning';

// ─── Original mode constants ──────────────────────────────────────────────────
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
  experimentalConfig?: ExperimentalConfig,
  onExperimentalMetrics?: (m: ExperimentalMetrics) => void,
): AircraftState | null {
  const [displayed, setDisplayed] = useState<AircraftState | null>(null);

  // ─── Shared refs ─────────────────────────────────────────────────────────
  const latestAuthRef = useRef<AircraftState | null>(null);
  const displayedRef = useRef<AircraftState | null>(null);
  const pollIntervalSecRef = useRef<number>(pollIntervalSec);
  const statusRef = useRef<TrackingStatus>(status);
  const onConvergenceRef = useRef(onConvergence);
  const onExperimentalMetricsRef = useRef(onExperimentalMetrics);
  const experimentalConfigRef = useRef(experimentalConfig);

  // ─── Original mode refs ───────────────────────────────────────────────────
  const residualRef = useRef<Residual>({ dLat: 0, dLng: 0, dAlt: 0, dHeadingDeg: 0 });
  const errorHistoryRef = useRef<number[]>([]);
  const kMultiplierRef = useRef<number>(1);
  const lastTickMsRef = useRef<number | null>(null);

  // ─── Experimental mode refs ───────────────────────────────────────────────
  const cameraPathRef = useRef<CameraPath | null>(null);
  const apiHistoryRef = useRef<AircraftState[]>([]);

  // Update all non-aircraft refs each render (safe — no side effects)
  useLayoutEffect(() => {
    onConvergenceRef.current = onConvergence;
    onExperimentalMetricsRef.current = onExperimentalMetrics;
    pollIntervalSecRef.current = pollIntervalSec;
    statusRef.current = status;
    experimentalConfigRef.current = experimentalConfig;

    // ── Clear state on signal lost or no aircraft ────────────────────────
    if (aircraft === null || status === TrackingStatus.SIGNAL_LOST) {
      latestAuthRef.current = null;
      displayedRef.current = null;
      // Original mode
      residualRef.current = { dLat: 0, dLng: 0, dAlt: 0, dHeadingDeg: 0 };
      errorHistoryRef.current = [];
      kMultiplierRef.current = 1;
      lastTickMsRef.current = null;
      // Experimental mode
      cameraPathRef.current = null;
      apiHistoryRef.current = [];
      return;
    }

    if (aircraft === latestAuthRef.current) return;

    // Reset all history when the tracked aircraft changes
    const icao24Changed =
      latestAuthRef.current !== null && aircraft.icao24 !== latestAuthRef.current.icao24;
    if (icao24Changed) {
      displayedRef.current = null;
      residualRef.current = { dLat: 0, dLng: 0, dAlt: 0, dHeadingDeg: 0 };
      errorHistoryRef.current = [];
      kMultiplierRef.current = 1;
      lastTickMsRef.current = null;
      cameraPathRef.current = null;
      apiHistoryRef.current = [];
    }

    latestAuthRef.current = aircraft;

    // ── Experimental path mode ────────────────────────────────────────────
    if (experimentalConfig?.enabled) {
      const nowMs = performance.now();
      const ageSec = Math.max(0, (Date.now() - aircraft.timestamp) / 1000);

      // Maintain API history ring buffer
      const hist = apiHistoryRef.current;
      hist.push(aircraft);
      if (hist.length > (experimentalConfig.historyN ?? 3)) hist.shift();

      const turnRateDegSec = weightedTurnRate(hist);

      // Age-corrected truth: where the plane actually is right now
      const truth = arcDeadReckon(aircraft, turnRateDegSec, ageSec);

      // Camera's current evaluated state (from its own path, never from API)
      let camEval: CameraEval;
      if (cameraPathRef.current) {
        camEval = evalCameraPath(cameraPathRef.current, nowMs);
      } else {
        // First ping — bootstrap camera at truth position
        const vel = velocityENU(truth.heading, truth.speed_ms);
        camEval = {
          lat: truth.lat,
          lng: truth.lng,
          alt_m: truth.alt_m,
          heading: truth.heading,
          speed_ms: truth.speed_ms,
          vertical_rate: truth.vertical_rate,
          velENU: vel,
          tSec: 0,
          tNorm: 0,
        };
        cameraPathRef.current = bootstrapCameraPath(truth, pollIntervalSecRef.current, nowMs);
        onConvergenceRef.current?.({
          errorMag_m: 0,
          halfLife_s: pollIntervalSecRef.current,
          k_multiplier: 1,
          trend: 'stable',
        });
        onExperimentalMetricsRef.current?.({
          errorMag_m: 0,
          turnRateDegSec,
          pathProgress: 0,
          pollSec: pollIntervalSecRef.current,
        });
        return;
      }

      const errorMag_m = haversineMeters(camEval, truth);
      const pollSec = pollIntervalSecRef.current;

      // Plan new path: camera's own current state → projected next API ping
      cameraPathRef.current = planCameraPath(camEval, truth, turnRateDegSec, pollSec, nowMs);

      onConvergenceRef.current?.({
        errorMag_m,
        halfLife_s: pollSec,
        k_multiplier: 1,
        trend: errorMag_m > 100 ? 'growing' : 'stable',
      });
      onExperimentalMetricsRef.current?.({
        errorMag_m,
        turnRateDegSec,
        pathProgress: camEval.tNorm,
        pollSec,
      });
      return;
    }

    // ── Original residual-decay mode ──────────────────────────────────────
    const ageSec = Math.max(0, (Date.now() - aircraft.timestamp) / 1000);
    const newTruth = interpolatePosition(aircraft, ageSec);
    const oldDisplayed = displayedRef.current;

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
  }, [aircraft, status, pollIntervalSec, onConvergence, experimentalConfig, onExperimentalMetrics]);

  useEffect(() => {
    let rafId: number;

    const tick = (now: number) => {
      const auth = latestAuthRef.current;
      const s = statusRef.current;
      const expConfig = experimentalConfigRef.current;

      if (!auth || s === TrackingStatus.SIGNAL_LOST) {
        setDisplayed(null);
        lastTickMsRef.current = null;
      } else if (expConfig?.enabled && cameraPathRef.current) {
        // ── Experimental: evaluate camera's own Hermite path ─────────────
        const cam = evalCameraPath(cameraPathRef.current, now);
        const next: AircraftState = {
          ...auth,
          lat: cam.lat,
          lng: cam.lng,
          alt_m: cam.alt_m,
          heading: cam.heading,
          speed_ms: cam.speed_ms,
          vertical_rate: cam.vertical_rate,
        };
        displayedRef.current = next;
        setDisplayed(next);
      } else {
        // ── Original: residual exponential decay ──────────────────────────
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

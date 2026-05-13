import type { AircraftState } from '../types/aircraft';
import { signedHeadingDeltaDeg } from './interpolation';

const DEG = Math.PI / 180;
const RAD = 180 / Math.PI;
const R_EARTH = 6_371_000; // m

// ─── Coordinate conversion ────────────────────────────────────────────────────

/** lat/lng → local East-North metres from an origin (flat-Earth, valid <~100 km) */
export function toENU(oLat: number, oLng: number, lat: number, lng: number): [number, number] {
  const cosLat = Math.cos(oLat * DEG);
  return [(lng - oLng) * DEG * R_EARTH * cosLat, (lat - oLat) * DEG * R_EARTH];
}

/** Local East-North metres → lat/lng */
export function fromENU(
  oLat: number,
  oLng: number,
  x: number,
  y: number,
): { lat: number; lng: number } {
  const cosLat = Math.cos(oLat * DEG);
  return {
    lat: oLat + (y / R_EARTH) * RAD,
    lng: oLng + (x / (R_EARTH * cosLat)) * RAD,
  };
}

// ─── Velocity helpers ─────────────────────────────────────────────────────────

/** ENU velocity [East, North] m/s from heading (°, N=0 CW) and speed (m/s) */
export function velocityENU(heading: number, speed: number): [number, number] {
  const rad = heading * DEG;
  return [speed * Math.sin(rad), speed * Math.cos(rad)];
}

/** Compass bearing (°) from an ENU velocity vector */
export function headingFromENU(vx: number, vy: number): number {
  return (Math.atan2(vx, vy) * RAD + 360) % 360;
}

// ─── Turn-rate estimation ─────────────────────────────────────────────────────

export function estimateTurnRateDegSec(prev: AircraftState, curr: AircraftState): number {
  const dtSec = (curr.timestamp - prev.timestamp) / 1000;
  if (dtSec < 0.5) return 0;
  return signedHeadingDeltaDeg(curr.heading, prev.heading) / dtSec;
}

/**
 * Weighted turn-rate estimate from an ordered history of API states (oldest→newest).
 * More recent segments are weighted more heavily (geometric decay).
 */
export function weightedTurnRate(history: AircraftState[]): number {
  if (history.length < 2) return 0;
  let totalW = 0;
  let weighted = 0;
  for (let i = history.length - 1; i >= 1; i--) {
    const age = history.length - 1 - i; // 0 = most recent segment
    const w = Math.pow(0.5, age);
    weighted += estimateTurnRateDegSec(history[i - 1], history[i]) * w;
    totalW += w;
  }
  const raw = totalW > 0 ? weighted / totalW : 0;
  return Math.max(-15, Math.min(15, raw)); // clamp to ±15 °/s
}

// ─── Circular arc dead reckoning ──────────────────────────────────────────────

/**
 * Project an AircraftState forward by `elapsedSec` using a constant turn rate.
 *
 * Derivation (heading measured CW from North, x=East, y=North):
 *   x(t) = (v/ω)(cos h₀ − cos(h₀+ωt))
 *   y(t) = (v/ω)(sin(h₀+ωt) − sin h₀)
 *
 * Degrades to linear when |ω| < 1e-5 rad/s.
 */
export function arcDeadReckon(
  last: AircraftState,
  turnRateDegSec: number,
  elapsedSec: number,
): AircraftState {
  const omega = turnRateDegSec * DEG; // rad/s
  const v = last.speed_ms;
  const h0 = last.heading * DEG;

  let x: number, y: number;
  if (Math.abs(omega) < 1e-5) {
    x = v * Math.sin(h0) * elapsedSec;
    y = v * Math.cos(h0) * elapsedSec;
  } else {
    const omegaT = omega * elapsedSec;
    x = (v / omega) * (Math.cos(h0) - Math.cos(h0 + omegaT));
    y = (v / omega) * (Math.sin(h0 + omegaT) - Math.sin(h0));
  }

  const pos = fromENU(last.lat, last.lng, x, y);
  return {
    ...last,
    lat: pos.lat,
    lng: pos.lng,
    heading: (((last.heading + turnRateDegSec * elapsedSec) % 360) + 360) % 360,
    alt_m: last.alt_m + last.vertical_rate * elapsedSec,
  };
}

// ─── Cubic Hermite spline ─────────────────────────────────────────────────────
//
// Parameterisation: s = t/T ∈ [0,1].
//
// P(s) = h00·P0 + h10·T·V0 + h01·P1 + h11·T·V1
//
// Boundary conditions (dP/dt, not dP/ds):
//   P(t=0) = P0,   dP/dt|₀ = V0
//   P(t=T) = P1,   dP/dt|₁ = V1

const h00 = (s: number) => 2 * s * s * s - 3 * s * s + 1;
const h10 = (s: number) => s * s * s - 2 * s * s + s;
const h01 = (s: number) => -2 * s * s * s + 3 * s * s;
const h11 = (s: number) => s * s * s - s * s;

const dh00 = (s: number) => 6 * s * s - 6 * s;
const dh10 = (s: number) => 3 * s * s - 4 * s + 1;
const dh01 = (s: number) => -6 * s * s + 6 * s;
const dh11 = (s: number) => 3 * s * s - 2 * s;

function hPos2(
  P0: [number, number],
  V0: [number, number],
  P1: [number, number],
  V1: [number, number],
  T: number,
  s: number,
): [number, number] {
  return [
    h00(s) * P0[0] + h10(s) * T * V0[0] + h01(s) * P1[0] + h11(s) * T * V1[0],
    h00(s) * P0[1] + h10(s) * T * V0[1] + h01(s) * P1[1] + h11(s) * T * V1[1],
  ];
}

// dP/dt = dP/ds * (1/T)
function hVel2(
  P0: [number, number],
  V0: [number, number],
  P1: [number, number],
  V1: [number, number],
  T: number,
  s: number,
): [number, number] {
  const inv = 1 / T;
  return [
    (dh00(s) * P0[0] + dh10(s) * T * V0[0] + dh01(s) * P1[0] + dh11(s) * T * V1[0]) * inv,
    (dh00(s) * P0[1] + dh10(s) * T * V0[1] + dh01(s) * P1[1] + dh11(s) * T * V1[1]) * inv,
  ];
}

function hPos1(p0: number, v0: number, p1: number, v1: number, T: number, s: number): number {
  return h00(s) * p0 + h10(s) * T * v0 + h01(s) * p1 + h11(s) * T * v1;
}

function hVel1(p0: number, v0: number, p1: number, v1: number, T: number, s: number): number {
  return (dh00(s) * p0 + dh10(s) * T * v0 + dh01(s) * p1 + dh11(s) * T * v1) / T;
}

// ─── Camera path ──────────────────────────────────────────────────────────────

export interface CameraPath {
  oLat: number;
  oLng: number; // ENU origin (= camera position at path start)
  P0: [number, number]; // start position (ENU m, always [0,0])
  V0: [number, number]; // start velocity (m/s, ENU) — camera's own velocity
  P1: [number, number]; // target position (ENU m)
  V1: [number, number]; // target velocity (m/s, ENU) — projected plane velocity
  alt0: number;
  altV0: number;
  alt1: number;
  altV1: number;
  T: number; // planned duration (s)
  startMs: number; // performance.now() when path was planned
  endTurnRateDegSec: number; // for arc continuation past T
}

export interface CameraEval {
  lat: number;
  lng: number;
  alt_m: number;
  heading: number;
  speed_ms: number;
  vertical_rate: number;
  velENU: [number, number];
  tSec: number; // seconds since path start
  tNorm: number; // t/T — >1 means coasting beyond planned end
}

export function evalCameraPath(path: CameraPath, nowMs: number): CameraEval {
  const tSec = (nowMs - path.startMs) / 1000;
  const tNorm = tSec / path.T;

  if (tSec <= path.T) {
    const s = tNorm;
    const [x, y] = hPos2(path.P0, path.V0, path.P1, path.V1, path.T, s);
    const [vx, vy] = hVel2(path.P0, path.V0, path.P1, path.V1, path.T, s);
    const pos = fromENU(path.oLat, path.oLng, x, y);
    const alt_m = hPos1(path.alt0, path.altV0, path.alt1, path.altV1, path.T, s);
    const vertical_rate = hVel1(path.alt0, path.altV0, path.alt1, path.altV1, path.T, s);
    const speed_ms = Math.sqrt(vx * vx + vy * vy);
    return {
      lat: pos.lat,
      lng: pos.lng,
      alt_m,
      heading: headingFromENU(vx, vy),
      speed_ms,
      vertical_rate,
      velENU: [vx, vy],
      tSec,
      tNorm,
    };
  }

  // Past path end: arc-continue from terminal state
  const tau = tSec - path.T;
  const termPos = fromENU(path.oLat, path.oLng, path.P1[0], path.P1[1]);
  const [V1x, V1y] = path.V1;
  const termSpeed = Math.sqrt(V1x * V1x + V1y * V1y);
  const termHeading = headingFromENU(V1x, V1y);

  const fakeState: AircraftState = {
    lat: termPos.lat,
    lng: termPos.lng,
    alt_m: path.alt1,
    heading: termHeading,
    speed_ms: termSpeed,
    vertical_rate: path.altV1,
    timestamp: 0,
    icao24: '',
    callsign: null,
  };
  const cont = arcDeadReckon(fakeState, path.endTurnRateDegSec, tau);
  const contVel = velocityENU(cont.heading, termSpeed);

  return {
    lat: cont.lat,
    lng: cont.lng,
    alt_m: cont.alt_m,
    heading: cont.heading,
    speed_ms: termSpeed,
    vertical_rate: path.altV1,
    velENU: contVel,
    tSec,
    tNorm,
  };
}

/**
 * Plan a camera path from the camera's current state (cam) to where the
 * plane is projected to be at the next poll.
 *
 * V0 always comes from the camera's own evaluated velocity — the API
 * state is only used to compute the target (P1, V1).
 */
export function planCameraPath(
  cam: CameraEval,
  ageCorrectedTruth: AircraftState, // arcDeadReckon(api, turnRate, ageSec)
  turnRateDegSec: number,
  pollSec: number,
  nowMs: number,
): CameraPath {
  // Project where the plane is expected at the next poll
  const nextApi = arcDeadReckon(ageCorrectedTruth, turnRateDegSec, pollSec);

  // ENU origin = camera's current position (so P0 = [0,0])
  const P1 = toENU(cam.lat, cam.lng, nextApi.lat, nextApi.lng);
  const V1 = velocityENU(nextApi.heading, nextApi.speed_ms);

  return {
    oLat: cam.lat,
    oLng: cam.lng,
    P0: [0, 0],
    V0: cam.velENU,
    P1,
    V1,
    alt0: cam.alt_m,
    altV0: cam.vertical_rate,
    alt1: nextApi.alt_m,
    altV1: nextApi.vertical_rate,
    T: pollSec,
    startMs: nowMs,
    endTurnRateDegSec: turnRateDegSec,
  };
}

/**
 * Bootstrap: initialise camera directly at the age-corrected truth on the first ping.
 */
export function bootstrapCameraPath(
  ageCorrectedTruth: AircraftState,
  pollSec: number,
  nowMs: number,
): CameraPath {
  const vel = velocityENU(ageCorrectedTruth.heading, ageCorrectedTruth.speed_ms);
  const cam: CameraEval = {
    lat: ageCorrectedTruth.lat,
    lng: ageCorrectedTruth.lng,
    alt_m: ageCorrectedTruth.alt_m,
    heading: ageCorrectedTruth.heading,
    speed_ms: ageCorrectedTruth.speed_ms,
    vertical_rate: ageCorrectedTruth.vertical_rate,
    velENU: vel,
    tSec: 0,
    tNorm: 0,
  };
  return planCameraPath(cam, ageCorrectedTruth, 0, pollSec, nowMs);
}

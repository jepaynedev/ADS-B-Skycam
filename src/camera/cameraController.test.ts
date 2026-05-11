import type { AircraftState } from '../types/aircraft';
import { CameraMode } from '../types/camera';
import type { LatLngAlt } from '../types/camera';
import { computeCameraParams } from './cameraController';

const aircraft: AircraftState = {
  icao24: 'abc123',
  callsign: 'TEST1',
  lat: 40.7128,
  lng: -74.006,
  alt_m: 10000,
  heading: 135,
  speed_ms: 250,
  vertical_rate: 0,
  timestamp: 1000,
};

describe('computeCameraParams — COCKPIT mode', () => {
  it('uses aircraft heading', () => {
    const p = computeCameraParams(aircraft, CameraMode.COCKPIT, {});
    expect(p.heading).toBe(aircraft.heading);
  });

  it('uses range=5 and tilt=85', () => {
    const p = computeCameraParams(aircraft, CameraMode.COCKPIT, {});
    expect(p.range).toBe(5);
    expect(p.tilt).toBe(85);
  });

  it('center matches aircraft position', () => {
    const p = computeCameraParams(aircraft, CameraMode.COCKPIT, {});
    expect(p.center.lat).toBe(aircraft.lat);
    expect(p.center.lng).toBe(aircraft.lng);
    expect(p.center.alt_m).toBe(aircraft.alt_m);
  });
});

describe('computeCameraParams — FREE_LOOK mode', () => {
  it('uses userHeading instead of aircraft heading', () => {
    const p = computeCameraParams(aircraft, CameraMode.FREE_LOOK, {
      userHeading: 270,
      userTilt: 60,
    });
    expect(p.heading).toBe(270);
    expect(p.tilt).toBe(60);
  });

  it('defaults userHeading to 0 when not provided', () => {
    const p = computeCameraParams(aircraft, CameraMode.FREE_LOOK, {});
    expect(p.heading).toBe(0);
  });

  it('defaults userTilt to 85 when not provided', () => {
    const p = computeCameraParams(aircraft, CameraMode.FREE_LOOK, {});
    expect(p.tilt).toBe(85);
  });
});

describe('computeCameraParams — CHASE mode', () => {
  it('uses aircraft heading and larger range', () => {
    const p = computeCameraParams(aircraft, CameraMode.CHASE, {});
    expect(p.heading).toBe(aircraft.heading);
    expect(p.range).toBeGreaterThan(5);
    expect(p.tilt).toBeLessThan(85);
  });
});

describe('computeCameraParams — TOWER mode', () => {
  it('uses the towerPosition when provided', () => {
    const tower: LatLngAlt = { lat: 41, lng: -73, alt_m: 50 };
    const p = computeCameraParams(aircraft, CameraMode.TOWER, { towerPosition: tower });
    expect(p.center.lat).toBe(tower.lat);
    expect(p.center.lng).toBe(tower.lng);
  });

  it('falls back to aircraft position when no towerPosition', () => {
    const p = computeCameraParams(aircraft, CameraMode.TOWER, {});
    expect(p.center.lat).toBe(aircraft.lat);
  });
});

describe('computeCameraParams — altitude clamping', () => {
  it('clamps altitude to minimum 10m', () => {
    const lowAlt = { ...aircraft, alt_m: 0 };
    const p = computeCameraParams(lowAlt, CameraMode.COCKPIT, {});
    expect(p.center.alt_m).toBe(10);
  });

  it('clamps negative altitude to 10m', () => {
    const belowGround = { ...aircraft, alt_m: -50 };
    const p = computeCameraParams(belowGround, CameraMode.COCKPIT, {});
    expect(p.center.alt_m).toBe(10);
  });

  it('does not clamp altitude above 10m', () => {
    const p = computeCameraParams(aircraft, CameraMode.COCKPIT, {});
    expect(p.center.alt_m).toBe(aircraft.alt_m);
  });
});

import type { AircraftState, RawStateVector } from './aircraft';
import { CameraMode } from './camera';
import type { CameraParams, LatLngAlt } from './camera';
import { TrackingStatus } from './tracking';
import type { TrackingState } from './tracking';

describe('CameraMode enum', () => {
  it('has correct string values', () => {
    expect(CameraMode.COCKPIT).toBe('COCKPIT');
    expect(CameraMode.FREE_LOOK).toBe('FREE_LOOK');
    expect(CameraMode.CHASE).toBe('CHASE');
    expect(CameraMode.TOWER).toBe('TOWER');
  });
});

describe('TrackingStatus enum', () => {
  it('has correct string values', () => {
    expect(TrackingStatus.IDLE).toBe('IDLE');
    expect(TrackingStatus.LIVE).toBe('LIVE');
    expect(TrackingStatus.DEAD_RECKONING).toBe('DEAD_RECKONING');
    expect(TrackingStatus.SIGNAL_LOST).toBe('SIGNAL_LOST');
  });
});

// Compile-time shape checks — ensure the types are structurally sound
describe('type shapes', () => {
  it('AircraftState has required fields', () => {
    const a: AircraftState = {
      icao24: 'a1b2c3',
      callsign: 'UAL123',
      lat: 40.0,
      lng: -74.0,
      alt_m: 10000,
      heading: 90,
      speed_ms: 250,
      vertical_rate: 0,
      timestamp: Date.now(),
    };
    expect(a.icao24).toBe('a1b2c3');
  });

  it('CameraParams has required fields', () => {
    const center: LatLngAlt = { lat: 0, lng: 0, alt_m: 0 };
    const p: CameraParams = { center, range: 5, tilt: 85, heading: 0 };
    expect(p.range).toBe(5);
  });

  it('TrackingState has required fields', () => {
    const s: TrackingState = { status: TrackingStatus.LIVE, lastPingTime: Date.now() };
    expect(s.status).toBe(TrackingStatus.LIVE);
  });

  it('RawStateVector can be typed', () => {
    const raw: RawStateVector = [
      'a1b2c3',
      'UAL123 ',
      'United States',
      1000,
      1000,
      -74.0,
      40.0,
      9000,
      false,
      250,
      90,
      0,
      null,
      9100,
      '1234',
      false,
      0,
    ];
    expect(raw[0]).toBe('a1b2c3');
  });
});

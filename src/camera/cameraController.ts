import type { AircraftState } from '../types/aircraft';
import { CameraMode } from '../types/camera';
import type { CameraParams, LatLngAlt } from '../types/camera';

const MIN_ALT_M = 10;

export interface CameraOptions {
  userHeading?: number;
  userTilt?: number;
  towerPosition?: LatLngAlt;
}

export function computeCameraParams(
  aircraft: AircraftState,
  mode: CameraMode,
  opts: CameraOptions,
): CameraParams {
  const alt_m = Math.max(aircraft.alt_m, MIN_ALT_M);

  switch (mode) {
    case CameraMode.COCKPIT:
      return {
        center: { lat: aircraft.lat, lng: aircraft.lng, alt_m },
        range: 5,
        tilt: 85,
        heading: aircraft.heading,
      };

    case CameraMode.FREE_LOOK:
      return {
        center: { lat: aircraft.lat, lng: aircraft.lng, alt_m },
        range: 5,
        tilt: opts.userTilt ?? 85,
        heading: opts.userHeading ?? 0,
      };

    case CameraMode.CHASE:
      return {
        center: { lat: aircraft.lat, lng: aircraft.lng, alt_m },
        range: 100,
        tilt: 70,
        heading: aircraft.heading,
      };

    case CameraMode.TOWER: {
      const center = opts.towerPosition ?? { lat: aircraft.lat, lng: aircraft.lng, alt_m };
      return {
        center,
        range: 500,
        tilt: 75,
        heading: aircraft.heading,
      };
    }
  }
}

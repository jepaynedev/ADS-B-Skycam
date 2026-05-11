export enum CameraMode {
  COCKPIT = 'COCKPIT',
  FREE_LOOK = 'FREE_LOOK',
  CHASE = 'CHASE',
  TOWER = 'TOWER',
}

export interface LatLngAlt {
  lat: number;
  lng: number;
  alt_m: number;
}

export interface CameraParams {
  center: LatLngAlt;
  range: number;
  tilt: number;
  heading: number;
}

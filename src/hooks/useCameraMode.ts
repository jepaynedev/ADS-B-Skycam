import { useState } from 'react';
import { CameraMode } from '../types/camera';

export function useCameraMode() {
  const [mode, setMode] = useState<CameraMode>(CameraMode.COCKPIT);
  const [userHeading, setUserHeading] = useState(0);
  const [userTilt, setUserTilt] = useState(85);

  return { mode, setMode, userHeading, setUserHeading, userTilt, setUserTilt };
}

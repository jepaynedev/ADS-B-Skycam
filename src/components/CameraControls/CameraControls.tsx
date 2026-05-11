import { CameraMode } from '../../types/camera';

interface CameraControlsProps {
  mode: CameraMode;
  onModeChange: (mode: CameraMode) => void;
  userHeading: number;
  onHeadingChange: (heading: number) => void;
  userTilt: number;
  onTiltChange: (tilt: number) => void;
}

const MODES: { mode: CameraMode; label: string }[] = [
  { mode: CameraMode.COCKPIT, label: 'Cockpit' },
  { mode: CameraMode.FREE_LOOK, label: 'Free Look' },
  { mode: CameraMode.CHASE, label: 'Chase' },
  { mode: CameraMode.TOWER, label: 'Tower' },
];

export function CameraControls({
  mode,
  onModeChange,
  userHeading,
  onHeadingChange,
  userTilt,
  onTiltChange,
}: CameraControlsProps) {
  return (
    <div className="camera-controls">
      <div className="camera-mode-buttons">
        {MODES.map(({ mode: m, label }) => (
          <button
            key={m}
            className={`mode-btn${mode === m ? ' active' : ''}`}
            onClick={() => onModeChange(m)}
          >
            {label}
          </button>
        ))}
      </div>

      {mode === CameraMode.FREE_LOOK && (
        <div className="free-look-controls">
          <label htmlFor="heading-slider">Heading: {Math.round(userHeading)}°</label>
          <input
            id="heading-slider"
            type="range"
            min={0}
            max={359}
            value={userHeading}
            onChange={(e) => onHeadingChange(Number(e.target.value))}
          />
          <label htmlFor="tilt-slider">Tilt: {Math.round(userTilt)}°</label>
          <input
            id="tilt-slider"
            type="range"
            min={0}
            max={90}
            value={userTilt}
            onChange={(e) => onTiltChange(Number(e.target.value))}
          />
        </div>
      )}
    </div>
  );
}

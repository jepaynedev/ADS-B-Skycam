import type { AircraftState } from '../../types/aircraft';
import type { TrackingStatus } from '../../types/tracking';
import { metersToFeet, msToFpm, msToKnots } from '../../utils/units';
import { StatusBadge } from '../StatusBadge/StatusBadge';

interface HudOverlayProps {
  aircraft: AircraftState | null;
  status: TrackingStatus;
}

function fmt(value: number | null | undefined, convert: (v: number) => number): string {
  if (value === null || value === undefined) return '---';
  return String(Math.round(convert(value)));
}

export function HudOverlay({ aircraft, status }: HudOverlayProps) {
  return (
    <div className="hud-overlay">
      <StatusBadge status={status} />
      <div className="hud-callsign">{aircraft?.callsign ?? '---'}</div>
      <div className="hud-row">
        <span className="hud-label">ALT</span>
        <span className="hud-value">{fmt(aircraft?.alt_m, metersToFeet)} ft</span>
      </div>
      <div className="hud-row">
        <span className="hud-label">SPD</span>
        <span className="hud-value">{fmt(aircraft?.speed_ms, msToKnots)} kts</span>
      </div>
      <div className="hud-row">
        <span className="hud-label">HDG</span>
        <span className="hud-value">{aircraft ? Math.round(aircraft.heading) : '---'}°</span>
      </div>
      <div className="hud-row">
        <span className="hud-label">V/S</span>
        <span className="hud-value">{fmt(aircraft?.vertical_rate, msToFpm)} fpm</span>
      </div>
    </div>
  );
}

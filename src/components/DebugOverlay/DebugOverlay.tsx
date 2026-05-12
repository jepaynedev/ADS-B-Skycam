import { useState } from 'react';
import type { DebugEvent } from '../../types/debug';
import { metersToFeet, msToKnots } from '../../utils/units';

interface DebugOverlayProps {
  events: DebugEvent[];
}

function fmtTime(timestamp: number): string {
  const d = new Date(timestamp);
  return d.toTimeString().slice(0, 8);
}

function EventRow({ event }: { event: DebugEvent }) {
  let dotClass = '';
  let desc = '';

  switch (event.type) {
    case 'request':
      dotClass = 'dot-yellow';
      desc = `↑ polling ${event.icao24}`;
      break;
    case 'success': {
      const alt = Math.round(metersToFeet(event.alt_m));
      const spd = Math.round(msToKnots(event.speed_ms));
      const hdg = Math.round(event.heading);
      const label = event.callsign || event.icao24;
      dotClass = 'dot-green';
      let conv = '';
      if (event.convergence) {
        const { errorMag_m, halfLife_s, k_multiplier, trend } = event.convergence;
        conv = ` · Δ${Math.round(errorMag_m)}m t½${halfLife_s.toFixed(1)}s ×${k_multiplier.toFixed(2)} ${trend}`;
      }
      desc = `✓ ${label} · ${alt}ft · ${spd}kts · ${hdg}°${conv}`;
      break;
    }
    case 'no_data':
      dotClass = 'dot-orange';
      desc = `○ no data · ${event.icao24}`;
      break;
    case 'error':
      dotClass = 'dot-red';
      desc = `✗ ${event.message}`;
      break;
    case 'camera_move': {
      const lat = event.lat.toFixed(4);
      const lng = event.lng.toFixed(4);
      const alt = Math.round(event.alt_m);
      const rng = Math.round(event.range);
      dotClass = 'dot-blue';
      desc = `⊕ ${lat}° ${lng}° · ${alt}m · rng ${rng}m`;
      break;
    }
  }

  return (
    <div className="debug-event">
      <span className={`debug-dot ${dotClass}`} />
      <span className="debug-time">{fmtTime(event.timestamp)}</span>
      <span className="debug-desc">{desc}</span>
    </div>
  );
}

export function DebugOverlay({ events }: DebugOverlayProps) {
  const [expanded, setExpanded] = useState(false);

  if (!expanded) {
    return (
      <div className="debug-overlay">
        <button className="debug-toggle" onClick={() => setExpanded(true)} title="Open debug log">
          ◉
        </button>
      </div>
    );
  }

  return (
    <div className="debug-overlay">
      <div className="debug-panel">
        <div className="debug-panel-header">
          <span className="debug-panel-title">Debug Log</span>
          <button className="debug-close" onClick={() => setExpanded(false)} title="Close">
            ✕
          </button>
        </div>
        <div className="debug-events">
          {events.length === 0 ? (
            <div className="debug-empty">No events yet</div>
          ) : (
            events.map((e) => <EventRow key={e.id} event={e} />)
          )}
        </div>
      </div>
    </div>
  );
}

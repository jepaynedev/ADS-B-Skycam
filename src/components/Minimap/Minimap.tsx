import { useEffect, useRef, useState } from 'react';
import { useTrackHistory } from '../../hooks/useTrackHistory';
import type { AircraftState } from '../../types/aircraft';
import { TrackingStatus } from '../../types/tracking';
import {
  ALT_GRADIENT_CSS,
  ALT_TICKS,
  ALT_MAX_M,
  ALT_MIN_M,
  altitudeToColor,
  quantiseAlt,
} from '../../utils/altitudeColor';

// A more realistic fixed-wing silhouette (pointing north = 0°)
const PLANE_PATH =
  'M 0,-12 L 2,-5 L 12,3 L 2,1 L 3,8 L 6,10 L 0,9 L -6,10 L -3,8 L -2,1 L -12,3 L -2,-5 Z';

const HISTORY_VISIBLE_KEY = 'adsb.minimap.history-visible';
const LEGEND_VISIBLE_KEY = 'adsb.minimap.legend-visible';
const SIZE_KEY = 'adsb.minimap.size';

function loadPersistedSize(): { width: number; height: number } | null {
  try {
    const raw = localStorage.getItem(SIZE_KEY);
    return raw ? (JSON.parse(raw) as { width: number; height: number }) : null;
  } catch {
    return null;
  }
}

function buildPlaneIcon(color: string, heading: number, opacity: number): google.maps.Symbol {
  return {
    path: PLANE_PATH,
    fillColor: color,
    fillOpacity: opacity,
    strokeColor: 'rgba(0,0,0,0.7)',
    strokeWeight: 0.5,
    rotation: heading,
    scale: 1.4,
    anchor: new google.maps.Point(0, 0),
  };
}

interface TrailSegment {
  path: google.maps.LatLngLiteral[];
  color: string;
}

export function buildTrailSegments(
  history: { lat: number; lng: number; alt_m: number }[],
): TrailSegment[] {
  if (history.length < 2) return [];
  const segments: TrailSegment[] = [];
  let segStart = 0;
  let currentBucket = quantiseAlt(history[0].alt_m);

  for (let i = 1; i <= history.length; i++) {
    const nextBucket = i < history.length ? quantiseAlt(history[i].alt_m) : -1;
    if (nextBucket !== currentBucket || i === history.length) {
      const end = i < history.length ? i : i - 1;
      const path = history.slice(segStart, end + 1).map((p) => ({ lat: p.lat, lng: p.lng }));
      if (path.length >= 2) {
        segments.push({ color: altitudeToColor(currentBucket + 250), path });
      }
      // Next segment starts at the transition point so segments share an endpoint
      segStart = i;
      currentBucket = nextBucket;
    }
  }
  return segments;
}

interface MinimapProps {
  aircraft: AircraftState | null;
  interpolated: AircraftState | null;
  status: TrackingStatus;
  googleMapsLoaded: boolean;
}

export function Minimap({ aircraft, interpolated, status, googleMapsLoaded }: MinimapProps) {
  const [expanded, setExpanded] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [historyVisible, setHistoryVisible] = useState(
    () => localStorage.getItem(HISTORY_VISIBLE_KEY) !== 'false',
  );
  const [legendVisible, setLegendVisible] = useState(
    () => localStorage.getItem(LEGEND_VISIBLE_KEY) !== 'false',
  );
  const [userHasPanned, setUserHasPanned] = useState(false);

  const { history } = useTrackHistory(aircraft);

  const mapDivRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const markerRef = useRef<google.maps.Marker | null>(null);
  const polylinesRef = useRef<google.maps.Polyline[]>([]);
  const userHasPannedRef = useRef(false);
  const lastCenterTimeRef = useRef(0);

  useEffect(() => {
    localStorage.setItem(HISTORY_VISIBLE_KEY, String(historyVisible));
  }, [historyVisible]);

  useEffect(() => {
    localStorage.setItem(LEGEND_VISIBLE_KEY, String(legendVisible));
  }, [legendVisible]);

  // Initialize map on first expand
  useEffect(() => {
    if (!expanded || !googleMapsLoaded || !mapDivRef.current) return;

    const center = interpolated
      ? { lat: interpolated.lat, lng: interpolated.lng }
      : { lat: 39.5, lng: -98.35 };

    const map = new google.maps.Map(mapDivRef.current, {
      center,
      zoom: 11,
      disableDefaultUI: true,
      gestureHandling: 'cooperative',
      clickableIcons: false,
    });
    mapRef.current = map;

    markerRef.current = new google.maps.Marker({
      position: center,
      map,
      icon: buildPlaneIcon(
        altitudeToColor(interpolated?.alt_m ?? 0),
        interpolated?.heading ?? 0,
        1,
      ),
    });

    map.addListener('dragstart', () => {
      userHasPannedRef.current = true;
      setUserHasPanned(true);
    });

    return () => {
      markerRef.current?.setMap(null);
      polylinesRef.current.forEach((p) => p.setMap(null));
      polylinesRef.current = [];
      mapRef.current = null;
      markerRef.current = null;
      userHasPannedRef.current = false;
      setUserHasPanned(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional: only init once on expand
  }, [expanded, googleMapsLoaded]);

  // Restore persisted size on open
  useEffect(() => {
    if (!expanded || !panelRef.current) return;
    const saved = loadPersistedSize();
    if (saved) {
      panelRef.current.style.width = `${saved.width}px`;
      panelRef.current.style.height = `${saved.height}px`;
    }
  }, [expanded]);

  // ResizeObserver: notify google maps + persist size
  useEffect(() => {
    if (!expanded || !panelRef.current || !mapRef.current) return;
    const panel = panelRef.current;
    const observer = new ResizeObserver(() => {
      if (mapRef.current) google.maps.event.trigger(mapRef.current, 'resize');
      const { width, height } = panel.getBoundingClientRect();
      if (width > 0 && height > 0) {
        localStorage.setItem(SIZE_KEY, JSON.stringify({ width, height }));
      }
    });
    observer.observe(panel);
    return () => observer.disconnect();
  }, [expanded, googleMapsLoaded]);

  // Update marker position + icon from smooth interpolated state
  useEffect(() => {
    if (!mapRef.current || !markerRef.current || !interpolated) return;

    const pos = { lat: interpolated.lat, lng: interpolated.lng };
    const opacity =
      status === TrackingStatus.SIGNAL_LOST
        ? 0.25
        : status === TrackingStatus.DEAD_RECKONING
          ? 0.6
          : 1;

    markerRef.current.setPosition(pos);
    markerRef.current.setIcon(
      buildPlaneIcon(altitudeToColor(interpolated.alt_m), interpolated.heading, opacity),
    );

    if (!userHasPannedRef.current) {
      const now = Date.now();
      if (now - lastCenterTimeRef.current > 200) {
        lastCenterTimeRef.current = now;
        mapRef.current.panTo(pos);
      }
    }
  }, [interpolated, status]);

  // Rebuild trail polylines when history or visibility changes
  useEffect(() => {
    if (!mapRef.current) return;
    polylinesRef.current.forEach((p) => p.setMap(null));
    polylinesRef.current = [];
    if (!historyVisible || history.length < 2) return;

    polylinesRef.current = buildTrailSegments(history).map(
      (seg) =>
        new google.maps.Polyline({
          path: seg.path,
          strokeColor: seg.color,
          strokeWeight: 2.5,
          strokeOpacity: 0.9,
          map: mapRef.current!,
        }),
    );
  }, [history, historyVisible, expanded, googleMapsLoaded]);

  // Custom drag-resize from the top-right handle
  function handleResizeStart(e: React.MouseEvent) {
    e.preventDefault();
    const panel = panelRef.current;
    if (!panel) return;

    const startX = e.clientX;
    const startY = e.clientY;
    const startW = panel.offsetWidth;
    const startH = panel.offsetHeight;

    function onMove(ev: MouseEvent) {
      const newW = Math.max(180, Math.min(window.innerWidth * 0.7, startW + (ev.clientX - startX)));
      const newH = Math.max(
        150,
        Math.min(window.innerHeight * 0.8, startH - (ev.clientY - startY)),
      );
      panel.style.width = `${newW}px`;
      panel.style.height = `${newH}px`;
      if (mapRef.current) google.maps.event.trigger(mapRef.current, 'resize');
    }

    function onUp() {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      if (panel) {
        const { width, height } = panel.getBoundingClientRect();
        if (width > 0 && height > 0) {
          localStorage.setItem(SIZE_KEY, JSON.stringify({ width, height }));
        }
      }
    }

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }

  function handleReCenter() {
    userHasPannedRef.current = false;
    lastCenterTimeRef.current = 0;
    setUserHasPanned(false);
    setMenuOpen(false);
    if (mapRef.current && interpolated) {
      mapRef.current.setCenter({ lat: interpolated.lat, lng: interpolated.lng });
    }
  }

  const canReCenter = userHasPanned && interpolated !== null;

  if (!expanded) {
    return (
      <div className="minimap-overlay">
        <button className="minimap-toggle" onClick={() => setExpanded(true)} title="Open minimap">
          ▲
        </button>
      </div>
    );
  }

  return (
    <div className="minimap-overlay">
      <div className="minimap-panel" ref={panelRef}>
        {/* Drag-resize handle at top-right */}
        <div
          className="minimap-resize-handle"
          onMouseDown={handleResizeStart}
          title="Drag to resize"
        >
          ⬔
        </div>

        <div className="minimap-header">
          <span className="minimap-title">MAP</span>
          <div className="minimap-header-controls">
            <button
              className="minimap-header-btn"
              onClick={() => setMenuOpen((v) => !v)}
              title="Settings"
            >
              ☰
            </button>
            <button
              className="minimap-header-btn"
              onClick={() => setExpanded(false)}
              title="Collapse minimap"
            >
              ▼
            </button>
          </div>
        </div>

        {menuOpen && (
          <div className="minimap-menu">
            <label className="minimap-menu-item">
              <input
                type="checkbox"
                checked={historyVisible}
                onChange={() => setHistoryVisible((v) => !v)}
              />
              <span>Trail</span>
            </label>
            <label className="minimap-menu-item">
              <input
                type="checkbox"
                checked={legendVisible}
                onChange={() => setLegendVisible((v) => !v)}
              />
              <span>Altitude key</span>
            </label>
            <button
              className={`minimap-menu-recenter${canReCenter ? '' : ' minimap-menu-recenter--disabled'}`}
              onClick={handleReCenter}
              disabled={!canReCenter}
            >
              ⊕ Re-center
            </button>
          </div>
        )}

        <div className="minimap-map-wrapper">
          <div ref={mapDivRef} className="minimap-map" />

          {/* Floating re-center badge */}
          {canReCenter && !menuOpen && (
            <button className="minimap-recenter" onClick={handleReCenter}>
              ⊕
            </button>
          )}

          {/* Gradient altitude legend — right side */}
          {legendVisible && (
            <div className="minimap-legend" aria-label="Altitude legend">
              <div className="minimap-legend-bar" style={{ background: ALT_GRADIENT_CSS }} />
              <div className="minimap-legend-ticks">
                {[...ALT_TICKS].reverse().map((tick) => {
                  const pct = ((tick.alt_m - ALT_MIN_M) / (ALT_MAX_M - ALT_MIN_M)) * 100;
                  // top% = 100 - pct because gradient top=high, bottom=low
                  const top = 100 - pct;
                  return (
                    <div
                      key={tick.alt_m}
                      className="minimap-legend-tick"
                      style={{ top: `${top}%` }}
                    >
                      <span className="minimap-legend-tick-line" />
                      <span className="minimap-legend-tick-label">{tick.label}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

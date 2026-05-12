import { useEffect, useRef, useState } from 'react';
import { useTrackHistory } from '../../hooks/useTrackHistory';
import type { AircraftState } from '../../types/aircraft';
import { TrackingStatus } from '../../types/tracking';
import { ALTITUDE_BANDS, altitudeToColor } from '../../utils/altitudeColor';

const PLANE_PATH = 'M 0,-10 L 6,8 L 0,4 L -6,8 Z';
const HISTORY_VISIBLE_KEY = 'adsb.minimap.history-visible';
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
    strokeColor: 'rgba(0,0,0,0.6)',
    strokeWeight: 0.5,
    rotation: heading,
    scale: 1.8,
    anchor: new google.maps.Point(0, 0),
  };
}

interface TrailSegment {
  path: google.maps.LatLngLiteral[];
  color: string;
}

function buildTrailSegments(
  history: { lat: number; lng: number; alt_m: number }[],
): TrailSegment[] {
  if (history.length < 2) return [];
  const segments: TrailSegment[] = [];
  let segStart = 0;
  let currentColor = altitudeToColor(history[0].alt_m);

  for (let i = 1; i <= history.length; i++) {
    const nextColor = i < history.length ? altitudeToColor(history[i].alt_m) : '';
    if (nextColor !== currentColor || i === history.length) {
      const end = i < history.length ? i : i - 1;
      segments.push({
        color: currentColor,
        // Include the next point as overlap for visual continuity between segments
        path: history.slice(segStart, end + 1).map((p) => ({ lat: p.lat, lng: p.lng })),
      });
      segStart = i - 1;
      currentColor = nextColor;
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
  const [historyVisible, setHistoryVisible] = useState(
    () => localStorage.getItem(HISTORY_VISIBLE_KEY) !== 'false',
  );
  const [userHasPanned, setUserHasPanned] = useState(false);

  const { history } = useTrackHistory(aircraft);

  const mapDivRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const markerRef = useRef<google.maps.Marker | null>(null);
  const polylinesRef = useRef<google.maps.Polyline[]>([]);
  const interpolatedRef = useRef(interpolated);
  const userHasPannedRef = useRef(false);
  const lastCenterTimeRef = useRef(0);

  useEffect(() => {
    interpolatedRef.current = interpolated;
  });

  useEffect(() => {
    localStorage.setItem(HISTORY_VISIBLE_KEY, String(historyVisible));
  }, [historyVisible]);

  // Initialize map on first expand
  useEffect(() => {
    if (!expanded || !googleMapsLoaded || !mapDivRef.current) return;

    const center = interpolatedRef.current
      ? { lat: interpolatedRef.current.lat, lng: interpolatedRef.current.lng }
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
        altitudeToColor(interpolatedRef.current?.alt_m ?? 0),
        interpolatedRef.current?.heading ?? 0,
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

  // ResizeObserver: notify map of container resize + persist size
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

  // Update marker position + heading + color from interpolated state
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
          strokeOpacity: 0.85,
          map: mapRef.current!,
        }),
    );
  }, [history, historyVisible, expanded, googleMapsLoaded]);

  function handleReCenter() {
    userHasPannedRef.current = false;
    setUserHasPanned(false);
    if (mapRef.current && interpolatedRef.current) {
      mapRef.current.panTo({
        lat: interpolatedRef.current.lat,
        lng: interpolatedRef.current.lng,
      });
    }
  }

  if (!expanded) {
    return (
      <div className="minimap-overlay">
        <button className="minimap-toggle" onClick={() => setExpanded(true)} title="Open minimap">
          ⊞
        </button>
      </div>
    );
  }

  return (
    <div className="minimap-overlay">
      <div className="minimap-panel" ref={panelRef}>
        <div className="minimap-header">
          <span className="minimap-title">MAP</span>
          <button
            className={`minimap-header-btn${historyVisible ? ' minimap-header-btn--active' : ''}`}
            onClick={() => setHistoryVisible((v) => !v)}
            title={historyVisible ? 'Hide trail' : 'Show trail'}
          >
            ◉ trail
          </button>
          <button
            className="minimap-header-btn"
            onClick={() => setExpanded(false)}
            title="Close minimap"
          >
            ✕
          </button>
        </div>
        <div className="minimap-map-wrapper">
          <div ref={mapDivRef} className="minimap-map" />
          {userHasPanned && (
            <button className="minimap-recenter" onClick={handleReCenter}>
              ⊕ Re-center
            </button>
          )}
          <div className="minimap-legend" aria-label="Altitude legend">
            {[...ALTITUDE_BANDS].reverse().map((band) => (
              <div key={band.label} className="minimap-legend-row">
                <span className="minimap-legend-swatch" style={{ background: band.color }} />
                <span className="minimap-legend-label">{band.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

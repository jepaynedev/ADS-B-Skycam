import { useCallback, useEffect, useRef, useState } from 'react';
import { CameraControls } from './components/CameraControls/CameraControls';
import { DebugOverlay } from './components/DebugOverlay';
import { ExperimentalPanel } from './components/ExperimentalPanel/ExperimentalPanel';
import { FlightSelector } from './components/FlightSelector/FlightSelector';
import { HudOverlay } from './components/HudOverlay/HudOverlay';
import { MapContainer } from './components/MapContainer/MapContainer';
import { Minimap } from './components/Minimap';
import { useAircraftTracking } from './hooks/useAircraftTracking';
import { useCameraMode } from './hooks/useCameraMode';
import { useDebugLog } from './hooks/useDebugLog';
import { useExperimentalConfig } from './hooks/useExperimentalConfig';
import { useInterpolation } from './hooks/useInterpolation';
import { useTrackHistory } from './hooks/useTrackHistory';
import { computeCameraParams } from './camera/cameraController';
import { config } from './config';
import type { AircraftState } from './types/aircraft';
import type { ConvergenceMetrics } from './types/debug';
import type { ExperimentalMetrics } from './types/experimental';

const DEFAULT_REFRESH_MS = 30_000;
const ICAO24_RE = /^[0-9a-f]{1,6}$/i;
const initialHex = new URLSearchParams(window.location.search).get('hex')?.toLowerCase() ?? '';

function App() {
  const [googleMapsLoaded, setGoogleMapsLoaded] = useState(false);

  const { events, addEvent } = useDebugLog();
  const lastConvergenceRef = useRef<ConvergenceMetrics | null>(null);

  // ─── Experimental config & metrics ───────────────────────────────────────
  const { config: experimentalConfig, setConfig: setExperimentalConfig } = useExperimentalConfig();
  const [experimentalMetrics, setExperimentalMetrics] = useState<ExperimentalMetrics | null>(null);

  // Ref gives the tracking hook immediate access to the computed poll interval
  // without needing a re-render to propagate a new refreshMs prop
  const dynamicRefreshMsRef = useRef(DEFAULT_REFRESH_MS);
  const experimentalConfigRef = useRef(experimentalConfig);
  useEffect(() => {
    experimentalConfigRef.current = experimentalConfig;
  }, [experimentalConfig]);

  const getRefreshMs = useCallback(() => dynamicRefreshMsRef.current, []);

  const handleExperimentalMetrics = useCallback((m: ExperimentalMetrics) => {
    setExperimentalMetrics(m);
    const cfg = experimentalConfigRef.current;
    if (!cfg?.enabled) return;
    const next = cfg.dynamicPolling
      ? Math.max(cfg.minPollMs, cfg.maxPollMs * Math.exp(-m.errorMag_m / cfg.errorThresholdM))
      : cfg.fixedPollMs;
    dynamicRefreshMsRef.current = Math.round(next);
  }, []);

  // Derived display value — recomputed each render from reactive state
  const currentPollMs = (() => {
    if (!experimentalConfig.enabled) return DEFAULT_REFRESH_MS;
    if (!experimentalConfig.dynamicPolling) return experimentalConfig.fixedPollMs;
    if (!experimentalMetrics) return experimentalConfig.maxPollMs;
    return Math.max(
      experimentalConfig.minPollMs,
      Math.round(
        experimentalConfig.maxPollMs *
          Math.exp(-experimentalMetrics.errorMag_m / experimentalConfig.errorThresholdM),
      ),
    );
  })();

  // ─── Tracking ─────────────────────────────────────────────────────────────
  const { aircraft, status, startTracking, stopTracking } = useAircraftTracking({
    refreshMs: DEFAULT_REFRESH_MS,
    getRefreshMs: experimentalConfig.enabled ? getRefreshMs : undefined,
    onPollEvent: (event) => {
      if (event.type === 'success' && lastConvergenceRef.current) {
        addEvent({ ...event, convergence: lastConvergenceRef.current });
      } else {
        addEvent(event);
      }
    },
  });

  useEffect(() => {
    if (initialHex && ICAO24_RE.test(initialHex)) void startTracking(initialHex);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // When experimental is toggled off, reset the dynamic ref back to default
  useEffect(() => {
    if (!experimentalConfig.enabled) {
      dynamicRefreshMsRef.current = DEFAULT_REFRESH_MS;
    }
  }, [experimentalConfig.enabled]);

  function handleTrack(icao24: string) {
    const params = new URLSearchParams(window.location.search);
    params.set('hex', icao24);
    history.replaceState(null, '', `?${params.toString()}`);
    void startTracking(icao24);
  }

  function handleStop() {
    const params = new URLSearchParams(window.location.search);
    params.delete('hex');
    const qs = params.toString();
    history.replaceState(null, '', qs ? `?${qs}` : window.location.pathname);
    stopTracking();
  }

  const { mode, setMode, userHeading, setUserHeading, userTilt, setUserTilt } = useCameraMode();

  const interpolated = useInterpolation(
    aircraft,
    status,
    currentPollMs / 1000,
    (m) => {
      lastConvergenceRef.current = m;
    },
    experimentalConfig,
    handleExperimentalMetrics,
  );

  const cameraParams = interpolated
    ? computeCameraParams(interpolated, mode, { userHeading, userTilt })
    : null;

  const prevAircraftRef = useRef<AircraftState | null>(null);
  useEffect(() => {
    if (aircraft && cameraParams && aircraft !== prevAircraftRef.current) {
      prevAircraftRef.current = aircraft;
      addEvent({
        type: 'camera_move',
        lat: cameraParams.center.lat,
        lng: cameraParams.center.lng,
        alt_m: cameraParams.center.alt_m,
        range: cameraParams.range,
      });
    }
  }, [aircraft, cameraParams, addEvent]);

  // ─── Camera trail for minimap (experimental only) ─────────────────────────
  const { history: cameraTrail } = useTrackHistory(
    experimentalConfig.enabled && experimentalConfig.showCameraTrail ? interpolated : null,
  );

  // ─── Google Maps script ───────────────────────────────────────────────────
  useEffect(() => {
    if (!config.googleMapsApiKey) return;

    const existing = document.querySelector<HTMLScriptElement>(
      'script[src*="maps.googleapis.com"]',
    );
    if (existing) {
      if (existing.dataset.loaded) setTimeout(() => setGoogleMapsLoaded(true), 0);
      else existing.addEventListener('load', () => setGoogleMapsLoaded(true), { once: true });
      return;
    }

    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${config.googleMapsApiKey}&v=weekly&libraries=maps3d&loading=async`;
    script.async = true;
    script.onload = () => {
      script.dataset.loaded = '1';
      setGoogleMapsLoaded(true);
    };
    document.head.appendChild(script);
  }, []);

  return (
    <div className="app">
      <MapContainer cameraParams={cameraParams} googleMapsLoaded={googleMapsLoaded} />
      <HudOverlay aircraft={interpolated} status={status} />
      <CameraControls
        mode={mode}
        onModeChange={setMode}
        userHeading={userHeading}
        onHeadingChange={setUserHeading}
        userTilt={userTilt}
        onTiltChange={setUserTilt}
      />
      <FlightSelector
        onTrack={handleTrack}
        onStop={handleStop}
        isTracking={aircraft !== null}
        initialHex={initialHex}
      />
      <Minimap
        aircraft={aircraft}
        interpolated={interpolated}
        status={status}
        googleMapsLoaded={googleMapsLoaded}
        cameraTrail={
          experimentalConfig.enabled && experimentalConfig.showCameraTrail ? cameraTrail : undefined
        }
      />
      <ExperimentalPanel
        config={experimentalConfig}
        setConfig={setExperimentalConfig}
        metrics={experimentalConfig.enabled ? experimentalMetrics : null}
        currentPollMs={currentPollMs}
      />
      <DebugOverlay events={events} />
    </div>
  );
}

export default App;

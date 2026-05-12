import { useEffect, useRef, useState } from 'react';
import { CameraControls } from './components/CameraControls/CameraControls';
import { DebugOverlay } from './components/DebugOverlay';
import { FlightSelector } from './components/FlightSelector/FlightSelector';
import { HudOverlay } from './components/HudOverlay/HudOverlay';
import { MapContainer } from './components/MapContainer/MapContainer';
import { useAircraftTracking } from './hooks/useAircraftTracking';
import { useCameraMode } from './hooks/useCameraMode';
import { useDebugLog } from './hooks/useDebugLog';
import { useInterpolation } from './hooks/useInterpolation';
import { computeCameraParams } from './camera/cameraController';
import { config } from './config';
import type { AircraftState } from './types/aircraft';

const ICAO24_RE = /^[0-9a-f]{1,6}$/i;
const initialHex = new URLSearchParams(window.location.search).get('hex')?.toLowerCase() ?? '';

function App() {
  const [googleMapsLoaded, setGoogleMapsLoaded] = useState(false);

  const { events, addEvent } = useDebugLog();
  const { aircraft, status, startTracking, stopTracking } = useAircraftTracking({
    onPollEvent: addEvent,
  });

  useEffect(() => {
    if (initialHex && ICAO24_RE.test(initialHex)) void startTracking(initialHex);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps -- intentionally runs once on mount

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
  const interpolated = useInterpolation(aircraft, status);

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

  useEffect(() => {
    if (!config.googleMapsApiKey) return;

    // If the script tag is already in the DOM (StrictMode double-invoke or HMR),
    // don't add a second copy — Maps registers custom elements globally and
    // re-registration throws. Instead just wait for the existing script to fire.
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
    // No cleanup: removing the script after Maps has registered its custom
    // elements causes "already defined" errors on StrictMode remount.
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
      <DebugOverlay events={events} />
    </div>
  );
}

export default App;

import { useEffect, useState } from 'react';
import { CameraControls } from './components/CameraControls/CameraControls';
import { FlightSelector } from './components/FlightSelector/FlightSelector';
import { HudOverlay } from './components/HudOverlay/HudOverlay';
import { MapContainer } from './components/MapContainer/MapContainer';
import { useAircraftTracking } from './hooks/useAircraftTracking';
import { useCameraMode } from './hooks/useCameraMode';
import { useInterpolation } from './hooks/useInterpolation';
import type { AreaBounds } from './services/opensky';
import { fetchAircraftByArea } from './services/opensky';
import { computeCameraParams } from './camera/cameraController';
import { config } from './config';

function App() {
  const [googleMapsLoaded, setGoogleMapsLoaded] = useState(false);

  const credentials =
    config.openSkyUsername && config.openSkyPassword
      ? { username: config.openSkyUsername, password: config.openSkyPassword }
      : undefined;

  const { aircraft, status, startTracking, stopTracking } = useAircraftTracking({
    credentials,
    adsbExchangeApiKey: config.adsbExchangeApiKey,
  });
  const { mode, setMode, userHeading, setUserHeading, userTilt, setUserTilt } = useCameraMode();
  const interpolated = useInterpolation(aircraft, status);

  const cameraParams = interpolated
    ? computeCameraParams(interpolated, mode, { userHeading, userTilt })
    : null;

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
    script.src = `https://maps.googleapis.com/maps/api/js?key=${config.googleMapsApiKey}&v=weekly&libraries=maps3d`;
    script.async = true;
    script.onload = () => {
      script.dataset.loaded = '1';
      setGoogleMapsLoaded(true);
    };
    document.head.appendChild(script);
    // No cleanup: removing the script after Maps has registered its custom
    // elements causes "already defined" errors on StrictMode remount.
  }, []);

  async function handleAreaSearch(bounds: AreaBounds) {
    const aircraft = await fetchAircraftByArea(bounds, credentials);
    if (aircraft.length > 0) {
      void startTracking(aircraft[0].icao24);
    }
  }

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
        onTrack={(icao24) => void startTracking(icao24)}
        onStop={stopTracking}
        onAreaSearch={(bounds) => void handleAreaSearch(bounds)}
        isTracking={aircraft !== null}
      />
    </div>
  );
}

export default App;

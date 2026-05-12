import { useEffect, useRef, useState } from 'react';
import type { CameraParams } from '../../types/camera';

interface MapContainerProps {
  cameraParams: CameraParams | null;
  googleMapsLoaded: boolean;
}

export function MapContainer({ cameraParams, googleMapsLoaded }: MapContainerProps) {
  const mapRef = useRef<HTMLElement | null>(null);
  // True once the gmp-map-3d element fires 'gmp-load' (internal WebGL/tile init done).
  // Camera commands before this event are silently dropped or queued by the element.
  const [mapReady, setMapReady] = useState(false);

  // Give the map an initial viewpoint so it loads tiles immediately.
  // Without center/range the element spins forever waiting for something to render.
  useEffect(() => {
    if (!googleMapsLoaded || !mapRef.current) return;
    const mapEl = mapRef.current as google.maps.maps3d.Map3DElement;
    mapEl.center = { lat: 39.5, lng: -98.35, altitude: 0 };
    mapEl.range = 5_000_000;
    mapEl.tilt = 0;
    mapEl.heading = 0;
    mapEl.addEventListener('gmp-load', () => setMapReady(true), { once: true });
    // Fallback: if gmp-load doesn't fire (e.g. API key issue or browser quirk),
    // unblock camera updates after 5 s so the tracker still works.
    const fallback = setTimeout(() => setMapReady(true), 5_000);
    return () => clearTimeout(fallback);
  }, [googleMapsLoaded]);

  // Per-frame camera tracking: set properties directly instead of flyCameraTo.
  // useInterpolation already produces a smoothly interpolated position each rAF
  // frame, so no additional animation duration is needed — and calling flyCameraTo
  // 60×/sec with durationMillis:200 queues/interrupts animations, causing the map
  // to freeze or only partially update.
  useEffect(() => {
    if (!cameraParams || !mapRef.current || !mapReady) return;

    const mapEl = mapRef.current as google.maps.maps3d.Map3DElement;
    mapEl.center = {
      lat: cameraParams.center.lat,
      lng: cameraParams.center.lng,
      altitude: cameraParams.center.alt_m,
    };
    mapEl.range = cameraParams.range;
    mapEl.tilt = cameraParams.tilt;
    mapEl.heading = cameraParams.heading;
  }, [cameraParams, mapReady]);

  if (!googleMapsLoaded) {
    return <div className="map-loading">Loading Google Maps…</div>;
  }

  return (
    <div className="map-container">
      {/* @ts-expect-error custom element ref */}
      <gmp-map-3d ref={mapRef} mode="satellite" style={{ width: '100%', height: '100%' }} />
    </div>
  );
}

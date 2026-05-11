import { useEffect, useRef } from 'react';
import type { CameraParams } from '../../types/camera';

interface MapContainerProps {
  cameraParams: CameraParams | null;
  googleMapsLoaded: boolean;
}

export function MapContainer({ cameraParams, googleMapsLoaded }: MapContainerProps) {
  const mapRef = useRef<HTMLElement | null>(null);

  // Give the map an initial viewpoint so it loads tiles immediately.
  // Without center/range the element spins forever waiting for something to render.
  useEffect(() => {
    if (!googleMapsLoaded || !mapRef.current) return;
    const mapEl = mapRef.current as google.maps.maps3d.Map3DElement;
    mapEl.center = { lat: 39.5, lng: -98.35, altitude: 0 };
    mapEl.range = 5_000_000;
    mapEl.tilt = 0;
    mapEl.heading = 0;
  }, [googleMapsLoaded]);

  useEffect(() => {
    if (!cameraParams || !mapRef.current) return;

    const mapEl = mapRef.current as google.maps.maps3d.Map3DElement;
    mapEl.flyCameraTo({
      endCamera: {
        center: {
          lat: cameraParams.center.lat,
          lng: cameraParams.center.lng,
          altitude: cameraParams.center.alt_m,
        },
        range: cameraParams.range,
        tilt: cameraParams.tilt,
        heading: cameraParams.heading,
      },
      durationMillis: 200,
    });
  }, [cameraParams]);

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

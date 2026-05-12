import { act, render, screen } from '@testing-library/react';
import type { CameraParams } from '../../types/camera';
import { MapContainer } from './MapContainer';

// Register a mock <gmp-map-3d> custom element for jsdom
class MockMap3DElement extends HTMLElement {
  center?: { lat: number; lng: number; altitude: number };
  range?: number;
  tilt?: number;
  heading?: number;
  flyCameraTo = jest.fn();
}
if (!customElements.get('gmp-map-3d')) {
  customElements.define('gmp-map-3d', MockMap3DElement);
}

const cameraParams: CameraParams = {
  center: { lat: 40.7, lng: -74.0, alt_m: 10000 },
  range: 5,
  tilt: 85,
  heading: 90,
};

describe('MapContainer', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('renders a loading message when googleMapsLoaded is false', () => {
    render(<MapContainer cameraParams={null} googleMapsLoaded={false} />);
    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });

  it('renders the gmp-map-3d element when googleMapsLoaded is true', () => {
    const { container } = render(<MapContainer cameraParams={null} googleMapsLoaded={true} />);
    expect(container.querySelector('gmp-map-3d')).toBeInTheDocument();
  });

  it('does not throw when cameraParams is null', () => {
    expect(() =>
      render(<MapContainer cameraParams={null} googleMapsLoaded={true} />),
    ).not.toThrow();
  });

  it('sets camera properties directly on the map element after gmp-load fires', () => {
    const { rerender } = render(<MapContainer cameraParams={null} googleMapsLoaded={true} />);

    const mapEl = document.querySelector('gmp-map-3d') as MockMap3DElement;

    // Fire gmp-load to open the mapReady gate
    act(() => {
      mapEl.dispatchEvent(new Event('gmp-load'));
    });

    rerender(<MapContainer cameraParams={cameraParams} googleMapsLoaded={true} />);

    expect(mapEl.center).toEqual({ lat: 40.7, lng: -74.0, altitude: 10000 });
    expect(mapEl.range).toBe(5);
    expect(mapEl.tilt).toBe(85);
    expect(mapEl.heading).toBe(90);
  });

  it('does not call flyCameraTo during per-frame tracking', () => {
    const { rerender } = render(<MapContainer cameraParams={null} googleMapsLoaded={true} />);

    const mapEl = document.querySelector('gmp-map-3d') as MockMap3DElement;
    act(() => {
      mapEl.dispatchEvent(new Event('gmp-load'));
    });

    rerender(<MapContainer cameraParams={cameraParams} googleMapsLoaded={true} />);

    expect(mapEl.flyCameraTo).not.toHaveBeenCalled();
  });

  it('sets camera properties via the 5s fallback when gmp-load never fires', () => {
    const { rerender } = render(
      <MapContainer cameraParams={cameraParams} googleMapsLoaded={true} />,
    );

    const mapEl = document.querySelector('gmp-map-3d') as MockMap3DElement;

    // Advance past the 5s fallback timer without firing gmp-load
    act(() => jest.advanceTimersByTime(5_001));
    rerender(<MapContainer cameraParams={cameraParams} googleMapsLoaded={true} />);

    expect(mapEl.center).toEqual({ lat: 40.7, lng: -74.0, altitude: 10000 });
  });

  it('does not update camera before gmp-load or fallback fires', () => {
    const { rerender } = render(<MapContainer cameraParams={null} googleMapsLoaded={true} />);
    const mapEl = document.querySelector('gmp-map-3d') as MockMap3DElement;
    const initialCenter = mapEl.center;

    rerender(<MapContainer cameraParams={cameraParams} googleMapsLoaded={true} />);

    // center should still be the initial viewpoint (set by the init effect), not the aircraft pos
    expect(mapEl.center).toEqual(initialCenter);
  });
});

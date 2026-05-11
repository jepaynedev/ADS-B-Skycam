import { render, screen } from '@testing-library/react';
import type { CameraParams } from '../../types/camera';
import { MapContainer } from './MapContainer';

// Register a mock <gmp-map-3d> custom element for jsdom
class MockMap3DElement extends HTMLElement {
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

  it('calls flyCameraTo on the map element when cameraParams change', () => {
    const { rerender } = render(<MapContainer cameraParams={null} googleMapsLoaded={true} />);
    rerender(<MapContainer cameraParams={cameraParams} googleMapsLoaded={true} />);

    const mapEl = document.querySelector('gmp-map-3d') as MockMap3DElement;
    expect(mapEl.flyCameraTo).toHaveBeenCalledWith(
      expect.objectContaining({
        endCamera: expect.objectContaining({
          center: expect.objectContaining({ lat: 40.7 }),
        }),
      }),
    );
  });
});

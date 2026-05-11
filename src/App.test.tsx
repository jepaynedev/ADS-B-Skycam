import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App';

jest.mock('./config');

jest.mock('./services/opensky', () => ({
  fetchAircraft: jest.fn().mockResolvedValue({
    icao24: 'abc123',
    callsign: 'TEST1',
    lat: 40.7,
    lng: -74.0,
    alt_m: 10000,
    heading: 90,
    speed_ms: 250,
    vertical_rate: 0,
    timestamp: Date.now(),
  }),
  fetchAircraftByArea: jest.fn().mockResolvedValue([]),
}));

// Register mock gmp-map-3d so MapContainer renders
if (!customElements.get('gmp-map-3d')) {
  customElements.define(
    'gmp-map-3d',
    class extends HTMLElement {
      flyCameraTo = jest.fn();
    },
  );
}

describe('App', () => {
  it('renders the flight selector initially', () => {
    render(<App />);
    expect(screen.getByPlaceholderText(/icao24/i)).toBeInTheDocument();
  });

  it('shows HudOverlay after entering an ICAO24 and tracking', async () => {
    render(<App />);
    await userEvent.type(screen.getByPlaceholderText(/icao24/i), 'abc123');
    await act(async () => {
      await userEvent.click(screen.getByRole('button', { name: /track/i }));
    });
    expect(screen.getByText('TEST1')).toBeInTheDocument();
  });

  it('renders camera controls', () => {
    render(<App />);
    expect(screen.getByText('Cockpit')).toBeInTheDocument();
  });

  it('shows LIVE status badge after tracking', async () => {
    render(<App />);
    await userEvent.type(screen.getByPlaceholderText(/icao24/i), 'abc123');
    await act(async () => {
      await userEvent.click(screen.getByRole('button', { name: /track/i }));
    });
    expect(screen.getByText('LIVE')).toBeInTheDocument();
  });
});

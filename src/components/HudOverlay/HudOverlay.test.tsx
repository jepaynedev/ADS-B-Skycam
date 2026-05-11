import { render, screen } from '@testing-library/react';
import type { AircraftState } from '../../types/aircraft';
import { TrackingStatus } from '../../types/tracking';
import { HudOverlay } from './HudOverlay';

const aircraft: AircraftState = {
  icao24: 'abc123',
  callsign: 'UAL123',
  lat: 40.7,
  lng: -74.0,
  alt_m: 10000,
  heading: 135,
  speed_ms: 250,
  vertical_rate: 5,
  timestamp: Date.now(),
};

describe('HudOverlay', () => {
  it('renders callsign', () => {
    render(<HudOverlay aircraft={aircraft} status={TrackingStatus.LIVE} />);
    expect(screen.getByText('UAL123')).toBeInTheDocument();
  });

  it('renders altitude in feet (rounded)', () => {
    render(<HudOverlay aircraft={aircraft} status={TrackingStatus.LIVE} />);
    // 10000 m * 3.28084 = 32808 ft
    expect(screen.getByText(/32808/)).toBeInTheDocument();
  });

  it('renders speed in knots (rounded)', () => {
    render(<HudOverlay aircraft={aircraft} status={TrackingStatus.LIVE} />);
    // 250 m/s * 1.94384 = 486 kts
    expect(screen.getByText(/486/)).toBeInTheDocument();
  });

  it('renders heading in degrees', () => {
    render(<HudOverlay aircraft={aircraft} status={TrackingStatus.LIVE} />);
    expect(screen.getByText(/135/)).toBeInTheDocument();
  });

  it('renders vertical rate in fpm (rounded)', () => {
    render(<HudOverlay aircraft={aircraft} status={TrackingStatus.LIVE} />);
    // 5 m/s * 196.85 = 984 fpm
    expect(screen.getByText(/984/)).toBeInTheDocument();
  });

  it('shows dashes when aircraft is null', () => {
    render(<HudOverlay aircraft={null} status={TrackingStatus.IDLE} />);
    const dashes = screen.getAllByText('---');
    expect(dashes.length).toBeGreaterThan(0);
  });

  it('shows negative vertical rate for descending aircraft', () => {
    render(
      <HudOverlay aircraft={{ ...aircraft, vertical_rate: -10 }} status={TrackingStatus.LIVE} />,
    );
    // -10 m/s * 196.85 = -1968.5, Math.round → -1968
    expect(screen.getByText(/-1968/)).toBeInTheDocument();
  });

  it('renders null callsign as dashes', () => {
    render(<HudOverlay aircraft={{ ...aircraft, callsign: null }} status={TrackingStatus.LIVE} />);
    expect(screen.getAllByText('---').length).toBeGreaterThan(0);
  });
});

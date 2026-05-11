import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { AreaBounds } from '../../services/opensky';
import { FlightSelector } from './FlightSelector';

const defaultProps = {
  onTrack: jest.fn(),
  onStop: jest.fn(),
  onAreaSearch: jest.fn(),
  isTracking: false,
};

describe('FlightSelector', () => {
  beforeEach(() => jest.clearAllMocks());

  it('renders the ICAO24 input', () => {
    render(<FlightSelector {...defaultProps} />);
    expect(screen.getByPlaceholderText(/icao24/i)).toBeInTheDocument();
  });

  it('calls onTrack with trimmed lowercased value on submit', async () => {
    render(<FlightSelector {...defaultProps} />);
    await userEvent.type(screen.getByPlaceholderText(/icao24/i), 'ABC123');
    await userEvent.click(screen.getByRole('button', { name: /track/i }));
    expect(defaultProps.onTrack).toHaveBeenCalledWith('abc123');
  });

  it('does not call onTrack on empty submit', async () => {
    render(<FlightSelector {...defaultProps} />);
    await userEvent.click(screen.getByRole('button', { name: /track/i }));
    expect(defaultProps.onTrack).not.toHaveBeenCalled();
  });

  it('shows validation error for non-hex ICAO24', async () => {
    render(<FlightSelector {...defaultProps} />);
    await userEvent.type(screen.getByPlaceholderText(/icao24/i), 'ZZZZZ!');
    await userEvent.click(screen.getByRole('button', { name: /track/i }));
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(defaultProps.onTrack).not.toHaveBeenCalled();
  });

  it('calls onStop when Stop button clicked while tracking', async () => {
    render(<FlightSelector {...defaultProps} isTracking={true} />);
    await userEvent.click(screen.getByRole('button', { name: /stop/i }));
    expect(defaultProps.onStop).toHaveBeenCalled();
  });

  it('calls onAreaSearch with bounds from geolocation when Search nearby clicked', async () => {
    const mockPosition = {
      coords: { latitude: 40.7, longitude: -74.0 },
    } as GeolocationPosition;

    const getCurrentPositionMock = jest.fn<void, [PositionCallback]>((success) =>
      success(mockPosition),
    );
    Object.defineProperty(navigator, 'geolocation', {
      value: { getCurrentPosition: getCurrentPositionMock },
      configurable: true,
    });

    render(<FlightSelector {...defaultProps} />);
    await userEvent.click(screen.getByRole('button', { name: /search nearby/i }));

    expect(defaultProps.onAreaSearch).toHaveBeenCalledWith(
      expect.objectContaining<Partial<AreaBounds>>({
        lamin: expect.any(Number),
        lomin: expect.any(Number),
        lamax: expect.any(Number),
        lomax: expect.any(Number),
      }),
    );
  });
});

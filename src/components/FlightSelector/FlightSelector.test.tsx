import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FlightSelector } from './FlightSelector';

const defaultProps = {
  onTrack: jest.fn(),
  onStop: jest.fn(),
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
});

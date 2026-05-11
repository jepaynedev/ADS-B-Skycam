import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CameraMode } from '../../types/camera';
import { CameraControls } from './CameraControls';

const defaultProps = {
  mode: CameraMode.COCKPIT,
  onModeChange: jest.fn(),
  userHeading: 0,
  onHeadingChange: jest.fn(),
  userTilt: 85,
  onTiltChange: jest.fn(),
};

describe('CameraControls', () => {
  beforeEach(() => jest.clearAllMocks());

  it('renders a button/option for each camera mode', () => {
    render(<CameraControls {...defaultProps} />);
    expect(screen.getByText('Cockpit')).toBeInTheDocument();
    expect(screen.getByText('Free Look')).toBeInTheDocument();
    expect(screen.getByText('Chase')).toBeInTheDocument();
    expect(screen.getByText('Tower')).toBeInTheDocument();
  });

  it('calls onModeChange with COCKPIT when Cockpit clicked', async () => {
    render(<CameraControls {...defaultProps} mode={CameraMode.FREE_LOOK} />);
    await userEvent.click(screen.getByText('Cockpit'));
    expect(defaultProps.onModeChange).toHaveBeenCalledWith(CameraMode.COCKPIT);
  });

  it('calls onModeChange with FREE_LOOK when Free Look clicked', async () => {
    render(<CameraControls {...defaultProps} />);
    await userEvent.click(screen.getByText('Free Look'));
    expect(defaultProps.onModeChange).toHaveBeenCalledWith(CameraMode.FREE_LOOK);
  });

  it('calls onModeChange with CHASE when Chase clicked', async () => {
    render(<CameraControls {...defaultProps} />);
    await userEvent.click(screen.getByText('Chase'));
    expect(defaultProps.onModeChange).toHaveBeenCalledWith(CameraMode.CHASE);
  });

  it('calls onModeChange with TOWER when Tower clicked', async () => {
    render(<CameraControls {...defaultProps} />);
    await userEvent.click(screen.getByText('Tower'));
    expect(defaultProps.onModeChange).toHaveBeenCalledWith(CameraMode.TOWER);
  });

  it('shows heading and tilt sliders only in FREE_LOOK mode', () => {
    render(<CameraControls {...defaultProps} mode={CameraMode.FREE_LOOK} />);
    expect(screen.getByLabelText(/heading/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/tilt/i)).toBeInTheDocument();
  });

  it('hides heading and tilt sliders in COCKPIT mode', () => {
    render(<CameraControls {...defaultProps} mode={CameraMode.COCKPIT} />);
    expect(screen.queryByLabelText(/heading/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/tilt/i)).not.toBeInTheDocument();
  });

  it('calls onHeadingChange when heading slider changes', () => {
    render(<CameraControls {...defaultProps} mode={CameraMode.FREE_LOOK} />);
    const slider = screen.getByLabelText(/heading/i);
    fireEvent.change(slider, { target: { value: '180' } });
    expect(defaultProps.onHeadingChange).toHaveBeenCalledWith(180);
  });
});

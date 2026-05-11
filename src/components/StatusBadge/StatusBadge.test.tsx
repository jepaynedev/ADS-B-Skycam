import { render, screen } from '@testing-library/react';
import { TrackingStatus } from '../../types/tracking';
import { StatusBadge } from './StatusBadge';

describe('StatusBadge', () => {
  it('renders "LIVE" for LIVE status', () => {
    render(<StatusBadge status={TrackingStatus.LIVE} />);
    expect(screen.getByText('LIVE')).toBeInTheDocument();
  });

  it('renders "DEAD RECKONING" for DEAD_RECKONING status', () => {
    render(<StatusBadge status={TrackingStatus.DEAD_RECKONING} />);
    expect(screen.getByText('DEAD RECKONING')).toBeInTheDocument();
  });

  it('renders "SIGNAL LOST" for SIGNAL_LOST status', () => {
    render(<StatusBadge status={TrackingStatus.SIGNAL_LOST} />);
    expect(screen.getByText('SIGNAL LOST')).toBeInTheDocument();
  });

  it('renders nothing for IDLE status', () => {
    const { container } = render(<StatusBadge status={TrackingStatus.IDLE} />);
    expect(container.firstChild).toBeNull();
  });

  it('applies live class for LIVE status', () => {
    render(<StatusBadge status={TrackingStatus.LIVE} />);
    expect(screen.getByText('LIVE')).toHaveClass('live');
  });

  it('applies signal-lost class for SIGNAL_LOST status', () => {
    render(<StatusBadge status={TrackingStatus.SIGNAL_LOST} />);
    expect(screen.getByText('SIGNAL LOST')).toHaveClass('signal-lost');
  });

  it('applies dead-reckoning class for DEAD_RECKONING status', () => {
    render(<StatusBadge status={TrackingStatus.DEAD_RECKONING} />);
    expect(screen.getByText('DEAD RECKONING')).toHaveClass('dead-reckoning');
  });
});

import { useState } from 'react';

const ICAO24_RE = /^[0-9a-f]{1,6}$/i;

interface FlightSelectorProps {
  onTrack: (icao24: string) => void;
  onStop: () => void;
  isTracking: boolean;
}

export function FlightSelector({ onTrack, onStop, isTracking }: FlightSelectorProps) {
  const [input, setInput] = useState('');
  const [error, setError] = useState<string | null>(null);

  function handleTrack() {
    const trimmed = input.trim().toLowerCase();
    if (!trimmed) return;
    if (!ICAO24_RE.test(trimmed)) {
      setError('Enter a valid 6-character hex ICAO24 code (e.g. a1b2c3)');
      return;
    }
    setError(null);
    onTrack(trimmed);
  }

  return (
    <div className="flight-selector">
      <input
        type="text"
        placeholder="ICAO24 hex (e.g. a1b2c3)"
        value={input}
        onChange={(e) => {
          setInput(e.target.value);
          setError(null);
        }}
        onKeyDown={(e) => e.key === 'Enter' && handleTrack()}
      />
      {error && (
        <span role="alert" className="flight-selector-error">
          {error}
        </span>
      )}
      <div className="flight-selector-buttons">
        <button onClick={handleTrack}>Track</button>
        {isTracking && <button onClick={onStop}>Stop</button>}
      </div>
    </div>
  );
}

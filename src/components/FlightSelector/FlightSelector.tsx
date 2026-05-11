import { useState } from 'react';
import type { AreaBounds } from '../../services/opensky';

const ICAO24_RE = /^[0-9a-f]{1,6}$/i;
const AREA_RADIUS_DEG = 2;

interface FlightSelectorProps {
  onTrack: (icao24: string) => void;
  onStop: () => void;
  onAreaSearch: (bounds: AreaBounds) => void;
  isTracking: boolean;
}

export function FlightSelector({ onTrack, onStop, onAreaSearch, isTracking }: FlightSelectorProps) {
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

  function handleSearchNearby() {
    navigator.geolocation.getCurrentPosition((pos) => {
      const { latitude: lat, longitude: lng } = pos.coords;
      onAreaSearch({
        lamin: lat - AREA_RADIUS_DEG,
        lomin: lng - AREA_RADIUS_DEG,
        lamax: lat + AREA_RADIUS_DEG,
        lomax: lng + AREA_RADIUS_DEG,
      });
    });
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
        <button onClick={handleSearchNearby}>Search nearby</button>
      </div>
    </div>
  );
}

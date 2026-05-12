import { useEffect, useRef, useState } from 'react';
import type { AircraftState } from '../types/aircraft';
import { haversineMeters } from '../utils/interpolation';

export interface TrackPoint {
  lat: number;
  lng: number;
  alt_m: number;
}

const MIN_SPACING_M = 50;
const MAX_POINTS = 2000;

export function useTrackHistory(aircraft: AircraftState | null): {
  history: TrackPoint[];
  clearHistory: () => void;
} {
  const [history, setHistory] = useState<TrackPoint[]>([]);
  const lastIcao24Ref = useRef<string | null>(null);
  const lastPointRef = useRef<TrackPoint | null>(null);

  useEffect(() => {
    if (aircraft === null) {
      if (lastIcao24Ref.current !== null) {
        lastIcao24Ref.current = null;
        lastPointRef.current = null;
        setHistory([]);
      }
      return;
    }

    const icao24Changed = aircraft.icao24 !== lastIcao24Ref.current;
    if (icao24Changed) {
      lastIcao24Ref.current = aircraft.icao24;
      lastPointRef.current = null;
    }

    const pt: TrackPoint = { lat: aircraft.lat, lng: aircraft.lng, alt_m: aircraft.alt_m };

    if (
      !lastPointRef.current ||
      icao24Changed ||
      haversineMeters(lastPointRef.current, pt) >= MIN_SPACING_M
    ) {
      lastPointRef.current = pt;
      setHistory((prev) => {
        const next = icao24Changed ? [pt] : [...prev, pt];
        return next.length > MAX_POINTS ? next.slice(-MAX_POINTS) : next;
      });
    }
  }, [aircraft]);

  function clearHistory() {
    setHistory([]);
    lastPointRef.current = null;
  }

  return { history, clearHistory };
}

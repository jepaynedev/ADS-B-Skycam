import { useCallback, useState } from 'react';
import type { DebugEvent, PollEvent } from '../types/debug';

const MAX_EVENTS = 100;
let nextId = 0;

type CameraMoveInput = {
  type: 'camera_move';
  lat: number;
  lng: number;
  alt_m: number;
  range: number;
};
type EventInput = PollEvent | CameraMoveInput;

export function useDebugLog() {
  const [events, setEvents] = useState<DebugEvent[]>([]);

  const addEvent = useCallback((input: EventInput) => {
    const event = { ...input, id: nextId++, timestamp: Date.now() } as DebugEvent;
    setEvents((prev) => {
      const updated = [event, ...prev];
      return updated.length > MAX_EVENTS ? updated.slice(0, MAX_EVENTS) : updated;
    });
  }, []);

  return { events, addEvent };
}

import { useEffect, useState } from 'react';
import { DEFAULT_EXPERIMENTAL_CONFIG } from '../types/experimental';
import type { ExperimentalConfig } from '../types/experimental';

const STORAGE_KEY = 'adsb.experimental';

function load(): ExperimentalConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw)
      return {
        ...DEFAULT_EXPERIMENTAL_CONFIG,
        ...(JSON.parse(raw) as Partial<ExperimentalConfig>),
      };
  } catch {
    // ignore
  }
  return DEFAULT_EXPERIMENTAL_CONFIG;
}

export function useExperimentalConfig(): {
  config: ExperimentalConfig;
  setConfig: (updates: Partial<ExperimentalConfig>) => void;
} {
  const [config, setConfigState] = useState<ExperimentalConfig>(load);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
    } catch {
      // ignore
    }
  }, [config]);

  function setConfig(updates: Partial<ExperimentalConfig>) {
    setConfigState((prev) => ({ ...prev, ...updates }));
  }

  return { config, setConfig };
}

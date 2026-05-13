import { useState } from 'react';
import type { ExperimentalConfig, ExperimentalMetrics } from '../../types/experimental';

interface ExperimentalPanelProps {
  config: ExperimentalConfig;
  setConfig: (updates: Partial<ExperimentalConfig>) => void;
  metrics: ExperimentalMetrics | null;
  currentPollMs: number;
}

function Slider({
  label,
  value,
  min,
  max,
  step,
  format,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  format: (v: number) => string;
  onChange: (v: number) => void;
}) {
  return (
    <div className="exp-slider-group">
      <div className="exp-row">
        <span className="exp-label">{label}</span>
        <span className="exp-value">{format(value)}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="exp-slider"
      />
    </div>
  );
}

export function ExperimentalPanel({
  config,
  setConfig,
  metrics,
  currentPollMs,
}: ExperimentalPanelProps) {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <div className="exp-overlay">
        <button
          className={`exp-toggle${config.enabled ? ' exp-toggle--active' : ''}`}
          onClick={() => setOpen(true)}
          title="Experimental pathing panel"
        >
          EXP
        </button>
      </div>
    );
  }

  return (
    <div className="exp-overlay">
      <div className="exp-panel">
        <div className="exp-header">
          <span className="exp-title">Experimental Pathing</span>
          <button className="exp-close" onClick={() => setOpen(false)} title="Close">
            ✕
          </button>
        </div>

        <div className="exp-body">
          <label className="exp-row exp-check-row">
            <span className="exp-label">Enable arc+Hermite paths</span>
            <input
              type="checkbox"
              checked={config.enabled}
              onChange={(e) => setConfig({ enabled: e.target.checked })}
            />
          </label>

          {config.enabled && (
            <>
              <div className="exp-section-title">Extrapolation</div>

              <Slider
                label="History points"
                value={config.historyN}
                min={2}
                max={5}
                step={1}
                format={(v) => String(v)}
                onChange={(v) => setConfig({ historyN: v })}
              />

              <div className="exp-section-title">Polling</div>

              <label className="exp-row exp-check-row">
                <span className="exp-label">Dynamic polling</span>
                <input
                  type="checkbox"
                  checked={config.dynamicPolling}
                  onChange={(e) => setConfig({ dynamicPolling: e.target.checked })}
                />
              </label>

              {config.dynamicPolling ? (
                <>
                  <Slider
                    label="Min poll"
                    value={config.minPollMs}
                    min={5_000}
                    max={20_000}
                    step={1_000}
                    format={(v) => `${(v / 1000).toFixed(0)}s`}
                    onChange={(v) => setConfig({ minPollMs: v })}
                  />
                  <Slider
                    label="Max poll"
                    value={config.maxPollMs}
                    min={15_000}
                    max={60_000}
                    step={5_000}
                    format={(v) => `${(v / 1000).toFixed(0)}s`}
                    onChange={(v) => setConfig({ maxPollMs: v })}
                  />
                  <Slider
                    label="Error threshold"
                    value={config.errorThresholdM}
                    min={50}
                    max={500}
                    step={25}
                    format={(v) => `${v}m`}
                    onChange={(v) => setConfig({ errorThresholdM: v })}
                  />
                </>
              ) : (
                <Slider
                  label="Fixed poll"
                  value={config.fixedPollMs}
                  min={5_000}
                  max={60_000}
                  step={5_000}
                  format={(v) => `${(v / 1000).toFixed(0)}s`}
                  onChange={(v) => setConfig({ fixedPollMs: v })}
                />
              )}

              <div className="exp-section-title">Minimap</div>
              <label className="exp-row exp-check-row">
                <span className="exp-label">Show camera trail</span>
                <input
                  type="checkbox"
                  checked={config.showCameraTrail}
                  onChange={(e) => setConfig({ showCameraTrail: e.target.checked })}
                />
              </label>

              <div className="exp-section-title">Live metrics</div>
              <div className="exp-stats">
                <div className="exp-stat">
                  <span className="exp-stat-label">Error</span>
                  <span className="exp-stat-value">
                    {metrics ? `${Math.round(metrics.errorMag_m)}m` : '—'}
                  </span>
                </div>
                <div className="exp-stat">
                  <span className="exp-stat-label">Turn</span>
                  <span className="exp-stat-value">
                    {metrics ? `${metrics.turnRateDegSec.toFixed(1)}°/s` : '—'}
                  </span>
                </div>
                <div className="exp-stat">
                  <span className="exp-stat-label">Path</span>
                  <span className="exp-stat-value">
                    {metrics ? `${Math.round(Math.min(metrics.pathProgress, 1) * 100)}%` : '—'}
                  </span>
                </div>
                <div className="exp-stat">
                  <span className="exp-stat-label">Poll</span>
                  <span className="exp-stat-value">{(currentPollMs / 1000).toFixed(0)}s</span>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

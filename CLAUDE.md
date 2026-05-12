# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

ADS-B Skycam is a React app that positions a Google Maps Photorealistic 3D camera at a real aircraft's location in real time, using live ADS-B flight data. It creates a cockpit-style first-person view from the aircraft's perspective.

## Commands

```bash
npm run dev          # Start Vite dev server at http://localhost:5173
npm run build        # Type-check + production build (tsc && vite build)
npm run test         # Run Jest unit tests
npm run test:watch   # Jest in watch mode
npm run e2e          # Run Playwright E2E tests
npm run lint         # ESLint check
npm run format       # Prettier auto-format
npm run ci           # Full CI check: tsc + prettier + eslint + jest + knip
```

Run a single Jest test file:
```bash
npx jest src/services/adsbLol.test.ts
```

## Environment Setup

Copy `.env.example` to `.env.local` and fill in:
- `VITE_GOOGLE_MAPS_API_KEY` — required; enables the 3D map
- `VITE_OPENSKY_USERNAME` / `VITE_OPENSKY_PASSWORD` — optional; reduces poll interval from 10s to 5s
- `VITE_ADSB_EXCHANGE_API_KEY` — optional; better global coverage

The Vite dev server proxies `/opensky/*` → OpenSky Network and `/adsb/*` → adsb.lol to bypass CORS.

## Architecture

### Data Flow

1. User enters an ICAO24 hex code in `FlightSelector`
2. `useAircraftTracking` polls the adsb.lol API every 10s (primary), with OpenSky and ADS-B Exchange as fallbacks
3. Each API response updates `AircraftState` and resets the dead-reckoning clock
4. `useInterpolation` runs on `requestAnimationFrame`, extrapolating position between API pings using velocity and haversine math
5. `useCameraMode` translates the current `CameraMode` and interpolated position into `CameraParams`
6. `MapContainer` calls `flyCameraTo()` on the Google Maps `Map3DElement` with 200ms transitions

### Camera Modes

Defined in `src/types/camera.ts` (`CameraMode` enum); computed in `src/camera/cameraController.ts`:
- **COCKPIT** — 5m range, 85° tilt, locked to aircraft heading
- **FREE_LOOK** — 5m range, user-controlled heading/tilt
- **CHASE** — 100m range, 70° tilt, locked to heading
- **TOWER** — 500m range, 75° tilt, stationary

### Tracking Status

`TrackingStatus` enum in `src/types/tracking.ts`: `IDLE → LIVE → DEAD_RECKONING → SIGNAL_LOST` (timeout at 60s). Status is displayed by `StatusBadge`.

### Key Files

| File | Purpose |
|------|---------|
| [src/hooks/useAircraftTracking.ts](src/hooks/useAircraftTracking.ts) | Polling loop, API fallback logic, tracking state |
| [src/hooks/useInterpolation.ts](src/hooks/useInterpolation.ts) | rAF-based dead-reckoning interpolation |
| [src/hooks/useCameraMode.ts](src/hooks/useCameraMode.ts) | Camera mode state and user heading/tilt controls |
| [src/camera/cameraController.ts](src/camera/cameraController.ts) | Maps `AircraftState + CameraMode → CameraParams` |
| [src/services/adsbLol.ts](src/services/adsbLol.ts) | Primary ADS-B data source |
| [src/components/MapContainer/](src/components/MapContainer/) | Google Maps 3D web component wrapper |
| [src/config.ts](src/config.ts) | All `VITE_*` env vars resolved in one place |

### Google Maps Integration

The app uses the `<gmp-map-3d>` custom element. The script is loaded dynamically in `MapContainer` to avoid React StrictMode double-invocation. Type declarations are in `src/types/google-maps-3d.d.ts`.

## Build & Deployment

- Vite base path: `/ADS-B-Skycam/` (GitHub Pages)
- GitHub Actions workflow in `.github/workflows/deploy.yml` builds and deploys on push to `master`
- Knip (`npm run ci`) detects unused exports — keep exports lean

## Testing

- **Jest** (jsdom + `@swc/jest`) for unit tests alongside source files (`*.test.ts`)
- **Playwright** for E2E in `e2e/`; auto-starts dev server; runs chromium only
- `jest.setup.ts` polyfills `requestAnimationFrame` for hook tests

# ADS-B Skycam

A web application that positions a Google Maps Photorealistic 3D camera at a real aircraft's location in real time, using live ADS-B flight tracking data from the OpenSky Network. The result is a first-person cockpit-style view of the world from that plane.

## Features

- Live ADS-B flight tracking via OpenSky Network REST API
- Dead-reckoning interpolation between data pings for smooth camera motion
- Google Maps Photorealistic 3D camera locked to aircraft position and altitude
- Cockpit, Free Look, Chase Cam, and Tower view modes
- Heads-up display: altitude (ft), speed (kts), heading (°), vertical rate (fpm)
- LIVE / DEAD RECKONING / SIGNAL LOST status indicators

## Prerequisites

- [Node.js](https://nodejs.org/) v20 or later
- A Google Cloud account with billing enabled
- A Google Maps JavaScript API key (see setup below)

## Environment Variables

Copy the example file and fill in your keys:

```
cp .env.example .env.local
```

| Variable | Required | Description |
|---|---|---|
| `VITE_GOOGLE_MAPS_API_KEY` | **Yes** | Google Maps JS API key |
| `VITE_OPENSKY_USERNAME` | No | OpenSky account username (reduces poll interval from 10s to 5s) |
| `VITE_OPENSKY_PASSWORD` | No | OpenSky account password |
| `VITE_ADSB_EXCHANGE_API_KEY` | No | ADS-B Exchange key (better global coverage) |

### Getting a Google Maps API Key

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project (or select an existing one)
3. Navigate to **APIs & Services → Library**
4. Search for and enable **Maps JavaScript API**
5. Navigate to **APIs & Services → Credentials**
6. Click **Create Credentials → API Key**
7. (Recommended) Restrict the key to your domain under **Key restrictions**
8. Paste the key as `VITE_GOOGLE_MAPS_API_KEY` in `.env.local`

> **Cost note:** The Maps JavaScript API has a free monthly credit (~$200). A personal project with occasional use will stay within the free tier. Check [Google Maps Platform pricing](https://developers.google.com/maps/billing-and-pricing/pricing) for details.

### Getting OpenSky Credentials (optional)

Anonymous users are rate-limited to one request per ~10 seconds. A free account reduces this to 5 seconds.

1. Register at [opensky-network.org](https://opensky-network.org/)
2. Add your username/password to `.env.local`

### Getting an ADS-B Exchange Key (optional)

ADS-B Exchange provides better global coverage and lower latency than OpenSky.

1. Visit [adsbexchange.com/data](https://www.adsbexchange.com/data/) for API access
2. Add your key as `VITE_ADSB_EXCHANGE_API_KEY` in `.env.local`

## Install

```
npm install
```

## Development

```
npm run dev
```

Open [http://localhost:5173](http://localhost:5173). Enter an ICAO24 hex code (e.g. `a1b2c3`) in the flight selector and click **Track** to begin.

To find live ICAO24 codes, use [FlightRadar24](https://www.flightradar24.com/) and click any aircraft — the hex code appears in the details panel.

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start the Vite dev server |
| `npm run build` | Type-check and build for production |
| `npm run preview` | Preview the production build locally |
| `npm test` | Run Jest test suite |
| `npm run test:watch` | Run tests in watch mode |
| `npm run test:coverage` | Run tests with coverage report |
| `npm run lint` | Run ESLint |
| `npm run format` | Auto-format source files with Prettier |
| `npm run format:check` | Check formatting without writing |
| `npm run knip` | Check for unused code and dependencies |
| `npm run ci` | Full CI check (type-check + format + lint + test + knip) |

## CI Check

Run the full check locally before pushing:

```
npm run ci
```

This runs: `tsc --noEmit` → `prettier --check` → `eslint` → `jest` → `knip`.

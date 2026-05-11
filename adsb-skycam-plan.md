# ADS-B Skycam — Project Plan

## Project Summary

A web application that pulls live ADS-B flight tracking data and uses it to position a Google Maps Photorealistic 3D camera at a real aircraft's location in real time, giving the user a first-person cockpit-style view of the world from that plane. The user can freely rotate the camera (heading/tilt), but position and altitude are locked to the aircraft's live telemetry.


---


## Tech Stack

| Layer | Choice | Notes |
|---|---|---|
| Frontend | Vanilla JS or React | Vanilla is simpler; React if you want component structure |
| 3D Map | Google Maps JS API (`maps3d` library) | Requires API key with Maps JS API enabled |
| ADS-B Data | OpenSky Network REST API | Free, no key required for anonymous use; ~5–10s refresh |
| Fallback ADS-B | ADS-B Exchange | Better global coverage, requires API key |
| Elevation reference | Google Maps Elevation API | Optional: for AGL correction at low altitudes |
| Hosting | Any static host (Netlify, Vercel, GitHub Pages) | No backend required for MVP |


---


## Data Sources

### OpenSky Network
- Base URL: `https://opensky-network.org/api`
- Endpoint for a specific aircraft: `GET /states/all?icao24={hex}`
- Endpoint to search by area: `GET /states/all?lamin={}&lomin={}&lamax={}&lomax={}`
- State vector fields you'll use:
  - `[5]` longitude (decimal degrees)
  - `[6]` latitude (decimal degrees)
  - `[7]` baro_altitude (meters, can be null)
  - `[13]` geo_altitude (meters above WGS84 — preferred)
  - `[10]` true_track (degrees from north, 0–360)
  - `[9]` velocity (m/s)
  - `[11]` vertical_rate (m/s, positive = climbing)
- Rate limit: ~10 second minimum between requests for anonymous users; 5s with a free account
- Full docs: https://openskynetwork.github.io/opensky-api/

### ADS-B Exchange (optional upgrade)
- Better coverage, more aircraft, lower latency
- API key required: https://www.adsbexchange.com/data/
- Drop-in replacement for OpenSky once you have a key


---


## Google Maps Setup

1. Create a project at https://console.cloud.google.com
2. Enable: **Maps JavaScript API**
3. Optionally enable: **Elevation API** (for AGL correction)
4. Create an API key; restrict it to your domain in production
5. Load the library:

```html
<script async
  src="https://maps.googleapis.com/maps/api/js?key=YOUR_KEY&v=weekly&libraries=maps3d">
</script>
```

### Map3DElement Camera Parameters

```javascript
const map = new Map3DElement({
  center: {
    lat: 0,
    lng: 0,
    altitude: 0,    // meters above ground level
  },
  range: 5,         // meters from center point; ~0 = camera IS at the plane
  tilt: 85,         // degrees; 0 = top-down, 90 = horizon
  heading: 0,       // compass degrees; 0 = north
  mode: 'SATELLITE',
});
```

Camera update method:
```javascript
map.flyCameraTo({
  endCamera: { center, range, tilt, heading },
  durationMillis: 1000,  // match to your poll interval for smooth motion
});
```


---


## Application Architecture

```
┌─────────────────────────────────────────┐
│                  UI Layer               │
│  [ Flight Selector ] [ Lock/Free Look ] │
│  [ Speed / Alt / Heading overlay ]      │
└────────────────┬────────────────────────┘
                 │
┌────────────────▼────────────────────────┐
│            State Manager                │
│  currentFlight, userHeading, userTilt   │
│  lockHeading (bool), lastPing, nextPing │
└──────┬──────────────────────┬───────────┘
       │                      │
┌──────▼──────┐      ┌────────▼────────┐
│  ADS-B Poll │      │  Interpolator   │
│  (setInterval│      │ (rAF loop)      │
│   ~5–10s)   │      │ dead reckoning  │
└──────┬──────┘      └────────┬────────┘
       │                      │
       └──────────┬───────────┘
                  │
       ┌──────────▼───────────┐
       │   Camera Controller  │
       │  map.flyCameraTo()   │
       └──────────────────────┘
```


---


## Core Modules

### 1. ADS-B Poller

```javascript
// Polls OpenSky every N seconds for a given ICAO24 hex code
async function fetchAircraft(icao24) {
  const url = `https://opensky-network.org/api/states/all?icao24=${icao24}`;
  const res = await fetch(url);
  const data = await res.json();
  if (!data.states || data.states.length === 0) return null;

  const s = data.states[0];
  return {
    icao24:        s[0],
    callsign:      s[1]?.trim(),
    lat:           s[6],
    lng:           s[5],
    alt_m:         s[13] ?? s[7],   // prefer geometric, fall back to baro
    heading:       s[10] ?? 0,
    speed_ms:      s[9]  ?? 0,
    vertical_rate: s[11] ?? 0,
    timestamp:     s[3],            // unix seconds
  };
}
```

### 2. Dead Reckoning Interpolator

Between ADS-B pings, estimate position using last known speed and heading:

```javascript
function interpolatePosition(last, now, elapsedSeconds) {
  const R = 6371000; // Earth radius in meters
  const distance = last.speed_ms * elapsedSeconds;
  const headingRad = (last.heading * Math.PI) / 180;

  const dLat = (distance * Math.cos(headingRad)) / R;
  const dLng = (distance * Math.sin(headingRad)) / (R * Math.cos(last.lat * Math.PI / 180));

  return {
    lat: last.lat + (dLat * 180) / Math.PI,
    lng: last.lng + (dLng * 180) / Math.PI,
    alt_m: last.alt_m + last.vertical_rate * elapsedSeconds,
    heading: last.heading,
    speed_ms: last.speed_ms,
    vertical_rate: last.vertical_rate,
  };
}
```

### 3. Camera Controller

```javascript
let userHeading = 0;
let userTilt = 85;
let lockToFlightHeading = true;

// Call on every rAF frame with interpolated position
function updateCamera(position) {
  map.flyCameraTo({
    endCamera: {
      center: {
        lat: position.lat,
        lng: position.lng,
        altitude: position.alt_m,
      },
      range: 5,
      heading: lockToFlightHeading ? position.heading : userHeading,
      tilt: userTilt,
    },
    durationMillis: 200,  // short duration in rAF mode for responsiveness
  });
}

// Capture user's free-look adjustments
map.addEventListener('gmp-centerchange', () => {
  if (!lockToFlightHeading) {
    userHeading = map.heading;
    userTilt = map.tilt;
  }
});
```

### 4. Flight Selector

Two modes:
- **By ICAO24** — user types a hex code directly (e.g. `a1b2c3`)
- **By callsign / area search** — query OpenSky for flights in a bounding box, display a list

For the area search approach, seed the bounding box from the user's browser geolocation or a default region.


---


## Camera Modes

| Mode | Behavior |
|---|---|
| **Cockpit (locked)** | Heading tracks aircraft true track; position + altitude locked to telemetry |
| **Free Look** | User drags to any heading/tilt; position + altitude still locked to plane |
| **Chase Cam** | Increase `range` to e.g. 50–200m, position the camera behind and above |
| **Tower View** | Camera stays fixed at a lat/lng on the ground; only center tracks the plane |

Implement as a mode enum and switch in `updateCamera()`.


---


## Altitude Handling

ADS-B altitude quirks to handle:

- `geo_altitude` (field 13) is meters above WGS84 ellipsoid — most accurate
- `baro_altitude` (field 7) is barometric, can differ by ±100m or more
- Google Maps altitude is **meters above ground level (AGL)**
- At cruise altitude the difference is negligible; near the ground it matters

**Optional AGL correction:**

```javascript
async function getGroundElevation(lat, lng) {
  const url = `https://maps.googleapis.com/maps/api/elevation/json?locations=${lat},${lng}&key=YOUR_KEY`;
  const res = await fetch(url);
  const data = await res.json();
  return data.results[0].elevation; // meters above sea level
}

// AGL = geometric altitude - ground elevation
const agl = aircraft.alt_m - groundElevation;
```

Cache ground elevation results — no need to re-fetch unless the plane has moved significantly horizontally.


---


## UI Components

### Minimal viable UI
- **Flight input box** — ICAO24 hex or callsign search
- **Start / Stop tracking** button
- **Heads-up overlay** — callsign, altitude (ft), speed (kts), heading (°), vertical rate
- **Lock heading toggle** — switches between cockpit-locked and free-look
- **Camera mode selector** — Cockpit / Chase / Tower

### HUD data conversions
```javascript
const alt_ft     = Math.round(aircraft.alt_m * 3.28084);
const speed_kts  = Math.round(aircraft.speed_ms * 1.94384);
const vs_fpm     = Math.round(aircraft.vertical_rate * 196.85);
```

### Status indicators
- "LIVE" badge when receiving fresh data (< 15s old)
- "DEAD RECKONING" badge when interpolating between pings
- "SIGNAL LOST" when no data for > 60s


---


## Failure & Edge Cases

| Case | Handling |
|---|---|
| Aircraft on ground (alt = 0 or null) | Clamp altitude to minimum ~10m AGL to avoid clipping into terrain |
| `geo_altitude` is null | Fall back to `baro_altitude`; flag in UI |
| Both altitudes null | Use last known altitude; show "DEAD RECKONING" |
| Aircraft disappears from feed | Hold last position; start countdown; show "SIGNAL LOST" after 60s |
| Rapid heading change (turn) | Smooth with heading interpolation; avoid >180° jumps by normalizing delta |
| Rate limiting (OpenSky) | Implement exponential backoff; show "Rate limited — slowing refresh" |
| API key missing / quota exceeded | Show clear error in UI; link to Google Cloud Console |


---


## Heading Interpolation (avoiding 360°/0° wrap-around jumps)

```javascript
function lerpHeading(a, b, t) {
  let delta = ((b - a + 540) % 360) - 180; // normalize to -180..180
  return (a + delta * t + 360) % 360;
}
```


---


## Development Phases

### Phase 1 — Static proof of concept
- Hard-code a single ICAO24
- Poll OpenSky, log state vectors to console
- Manually position Map3DElement camera at returned lat/lng/alt
- Confirm the view looks correct

### Phase 2 — Live camera tracking
- Wire poll results into `flyCameraTo()`
- Add dead-reckoning interpolation loop
- Test with a commercial flight at cruise altitude

### Phase 3 — UI & controls
- Add flight selector (ICAO24 input)
- Add HUD overlay
- Implement lock/free-look toggle
- Add camera mode switcher

### Phase 4 — Polish
- AGL correction via Elevation API
- Heading smoothing
- Error/signal-lost states
- Mobile touch support
- Consider rate-limit upgrade (OpenSky account or ADS-B Exchange key)


---


## Known Limitations

- **OpenSky refresh rate** (~10s anonymous) means position is always slightly behind; dead reckoning fills the gap but drifts during turns
- **Google Maps 3D** requires a paid API key; free tier has a monthly credit but high-traffic use will incur costs
- **ADS-B coverage gaps** — oceanic flights disappear; some regions have sparse receiver networks
- **No attitude data** — ADS-B doesn't include pitch or roll, only true track and vertical rate; the camera tilt approximation won't show banking
- **Terrain clipping** — at very low altitudes (approach/landing) the camera may clip into terrain depending on 3D tile accuracy


---


## Reference Links

- Google Maps 3D API docs: https://developers.google.com/maps/documentation/javascript/3d/
- Map3DElement reference: https://developers.google.com/maps/documentation/javascript/reference/3d-map
- Camera positioning example: https://developers.google.com/maps/documentation/javascript/examples/3d/move-camera
- OpenSky API docs: https://openskynetwork.github.io/opensky-api/
- OpenSky state vector fields: https://openskynetwork.github.io/opensky-api/rest.html#all-state-vectors
- ADS-B Exchange API: https://www.adsbexchange.com/data/

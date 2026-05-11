export interface AircraftState {
  icao24: string;
  callsign: string | null;
  lat: number;
  lng: number;
  alt_m: number;
  heading: number;
  speed_ms: number;
  vertical_rate: number;
  timestamp: number;
}

// OpenSky state vector: 17-element array
// indices: [0]=icao24, [1]=callsign, [2]=origin_country, [3]=time_position,
// [4]=last_contact, [5]=lng, [6]=lat, [7]=baro_altitude, [8]=on_ground,
// [9]=velocity, [10]=true_track, [11]=vertical_rate, [12]=sensors,
// [13]=geo_altitude, [14]=squawk, [15]=spi, [16]=position_source
export type RawStateVector = [
  string, // 0 icao24
  string | null, // 1 callsign
  string, // 2 origin_country
  number | null, // 3 time_position
  number, // 4 last_contact
  number | null, // 5 longitude
  number | null, // 6 latitude
  number | null, // 7 baro_altitude
  boolean, // 8 on_ground
  number | null, // 9 velocity
  number | null, // 10 true_track
  number | null, // 11 vertical_rate
  number[] | null, // 12 sensors
  number | null, // 13 geo_altitude
  string | null, // 14 squawk
  boolean, // 15 spi
  number, // 16 position_source
];

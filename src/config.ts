export const config = {
  googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string,
  openSkyUsername: import.meta.env.VITE_OPENSKY_USERNAME as string | undefined,
  openSkyPassword: import.meta.env.VITE_OPENSKY_PASSWORD as string | undefined,
  adsbExchangeApiKey: import.meta.env.VITE_ADSB_EXCHANGE_API_KEY as string | undefined,
  // In dev, route through the Vite proxy (/opensky → opensky-network.org) to
  // avoid CORS restrictions on unauthenticated browser requests.
  openSkyBase:
    (import.meta.env.VITE_OPENSKY_BASE as string | undefined) ??
    (import.meta.env.DEV ? '/opensky/api' : 'https://opensky-network.org/api'),
  adsbLolBase:
    (import.meta.env.VITE_ADSB_LOL_BASE as string | undefined) ??
    (import.meta.env.DEV ? '/adsb/v2' : 'https://api.adsb.lol/v2/'),

};

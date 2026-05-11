export const config = {
  googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string,
  openSkyUsername: import.meta.env.VITE_OPENSKY_USERNAME as string | undefined,
  openSkyPassword: import.meta.env.VITE_OPENSKY_PASSWORD as string | undefined,
  adsbExchangeApiKey: import.meta.env.VITE_ADSB_EXCHANGE_API_KEY as string | undefined,
};

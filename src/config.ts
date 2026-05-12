export const config = {
  googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string,
  adsbLolBase:
    (import.meta.env.VITE_ADSB_LOL_BASE as string | undefined) ??
    (import.meta.env.DEV ? '/adsb/v2' : 'https://api.adsb.lol/v2'),
};

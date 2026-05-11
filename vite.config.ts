import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  base: '/ADS-B-Skycam/',
  plugins: [react()],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  server: {
    proxy: {
      // Proxy OpenSky requests to avoid browser CORS restrictions.
      // Unauthenticated OpenSky responses set Access-Control-Allow-Origin to
      // their own domain only; a server-side proxy sidesteps that.
      '/opensky': {
        target: 'https://opensky-network.org',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/opensky/, ''),
      },
      '/adsb': {
        target: 'https://api.adsb.lol',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/adsb/, ''),
      },
    },
  },
});

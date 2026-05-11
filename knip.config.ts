import type { KnipConfig } from 'knip';

const config: KnipConfig = {
  project: ['src/**/*.{ts,tsx}', 'e2e/**/*.ts'],
  ignore: ['src/types/google-maps-3d.d.ts'],
  ignoreDependencies: ['@jest/globals'],
  playwright: {
    config: ['playwright.config.ts'],
  },
};

export default config;

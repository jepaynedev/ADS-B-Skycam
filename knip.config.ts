import type { KnipConfig } from 'knip';

const config: KnipConfig = {
  project: ['src/**/*.{ts,tsx}'],
  ignore: ['src/types/google-maps-3d.d.ts'],
  ignoreDependencies: ['@testing-library/user-event', '@jest/globals'],
};

export default config;

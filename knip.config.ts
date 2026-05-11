import type { KnipConfig } from 'knip';

const config: KnipConfig = {
  project: ['src/**/*.{ts,tsx}'],
  ignoreDependencies: ['@testing-library/user-event', '@jest/globals'],
};

export default config;

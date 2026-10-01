import { defineConfig } from '@playwright/test';
import base from './playwright.config.js';
export default defineConfig({
  ...base,
  testIgnore: [],
  testMatch: 'rail.spec.ts',
  webServer: {
    command: 'exec node --import tsx scripts/rail-browser-server.ts',
    url: 'http://127.0.0.1:4310/health',
    reuseExistingServer: false,
    timeout: 60000,
    gracefulShutdown: { signal: 'SIGTERM', timeout: 10000 },
  },
});

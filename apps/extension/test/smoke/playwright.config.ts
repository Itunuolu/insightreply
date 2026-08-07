import { defineConfig } from '@playwright/test';

/**
 * Smoke test: loads the built extension into a real Chromium instance.
 * Requires `pnpm build:extension` first (the test:smoke script does it).
 * Headed mode is required for extensions; set PLAYWRIGHT_HEADLESS=1 to force
 * headless where the browser supports extensions in headless.
 */
export default defineConfig({
  testDir: '.',
  timeout: 90_000,
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: {
    headless: process.env.PLAYWRIGHT_HEADLESS === '1',
    viewport: { width: 1280, height: 900 },
  },
});
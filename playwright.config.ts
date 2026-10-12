import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'tests/e2e',
  reporter: process.env.CI ? [['dot'], ['html', { open: 'never' }]] : 'list',
  use: { baseURL: 'http://localhost:4399', trace: 'retain-on-failure' },
  webServer: {
    command: 'npm run build && npx astro preview --port 4399',
    url: 'http://localhost:4399',
    reuseExistingServer: false,
    timeout: 180_000,
    // Astro 7's preview backgrounds itself when it detects an AI agent, which Playwright reads as a crash.
    env: { ASTRO_PREVIEW_BACKGROUND: '1' },
  },
  projects: [
    {
      name: 'phone',
      use: { browserName: 'chromium', viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true, deviceScaleFactor: 3 },
    },
    { name: 'desktop', use: { browserName: 'chromium', viewport: { width: 1280, height: 800 } } },
  ],
});

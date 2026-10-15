import { defineConfig } from '@playwright/test';

// Set E2E_PORT to run e2e in a second worktree at the same time.
const port = Number(process.env.E2E_PORT ?? 4399);

export default defineConfig({
  testDir: 'tests/e2e',
  reporter: process.env.CI ? [['dot'], ['html', { open: 'never' }]] : 'list',
  use: { baseURL: `http://localhost:${port}`, trace: 'retain-on-failure' },
  webServer: {
    command: `npm run build && npx astro preview --port ${port}`,
    url: `http://localhost:${port}`,
    reuseExistingServer: false,
    timeout: 180_000,
    // Astro 7's preview backgrounds itself when it detects an AI agent, which Playwright reads as a crash.
    // E2E_FIGURES=1 builds the figure test pages (src/pages/figure-test/); a production build never has them.
    env: { ASTRO_PREVIEW_BACKGROUND: '1', E2E_FIGURES: '1' },
  },
  projects: [
    {
      name: 'phone',
      use: { browserName: 'chromium', viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true, deviceScaleFactor: 3 },
    },
    { name: 'desktop', use: { browserName: 'chromium', viewport: { width: 1280, height: 800 } } },
  ],
});

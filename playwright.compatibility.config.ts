import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/compatibility',
  outputDir: 'test-results/compatibility',
  timeout: 120_000,
  workers: 1,
  retries: 0,
  forbidOnly: Boolean(process.env.CI),
  reporter: [['list'], ['json', { outputFile: 'test-results/compatibility-results.json' }]],
  use: { baseURL: 'http://127.0.0.1:4175', viewport: { width: 1440, height: 1000 },
    trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  projects: [
    { name: 'production-chrome', use: { browserName: 'chromium', channel: process.env.PLAYWRIGHT_CHANNEL ?? 'chrome' } },
    { name: 'production-firefox', use: { browserName: 'firefox' } },
  ],
  webServer: { command: 'npm run preview -- --port 4175 --strictPort', url: 'http://127.0.0.1:4175', reuseExistingServer: false },
});

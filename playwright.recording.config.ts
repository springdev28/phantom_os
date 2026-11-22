import { defineConfig } from '@playwright/test';

/** Genuine local evidence capture, not an edited/narrated submission video. */
export default defineConfig({
  testDir: './tests/recording', outputDir: 'test-results/recording',
  timeout: 120_000, workers: 1, retries: 0,
  reporter: [['list'], ['json', { outputFile: 'test-results/recording-results.json' }]],
  use: { browserName: 'chromium', channel: process.env.PLAYWRIGHT_CHANNEL ?? 'chrome',
    baseURL: 'http://127.0.0.1:4174', viewport: { width: 1440, height: 1000 },
    video: { mode: 'on', size: { width: 1440, height: 1000 } }, trace: 'retain-on-failure' },
  webServer: { command: 'npm run preview -- --port 4174 --strictPort',
    url: 'http://127.0.0.1:4174', reuseExistingServer: false },
});

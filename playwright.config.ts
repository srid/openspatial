import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  // Tests are safe to run in parallel because every scenario() uses a unique,
  // deterministic space ID, ensuring zero cross-test state contamination.
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 4 : undefined, // CI: 4 workers; local: Playwright default (half CPU cores)
  reporter: 'html',
  use: {
    baseURL: 'https://localhost:5173',
    trace: 'on-first-retry',
    ignoreHTTPSErrors: true, // Accept self-signed certs
  },
  projects: [
    {
      name: 'chromium',
      testIgnore: '**/mobile.spec.ts', // Skip mobile-specific tests
      use: {
        ...devices['Desktop Chrome'],
        // Grant permissions for media
        permissions: ['camera', 'microphone'],
        ignoreHTTPSErrors: true,
        launchOptions: {
          args: [
            '--use-fake-device-for-media-stream',
            '--use-fake-ui-for-media-stream',
            '--ignore-certificate-errors',
          ],
        },
      },
    },
    {
      name: 'mobile',
      testMatch: '**/mobile.spec.ts', // Only run mobile-specific tests
      use: {
        ...devices['Pixel 5'],
        permissions: ['camera', 'microphone'],
        ignoreHTTPSErrors: true,
        launchOptions: {
          args: [
            '--use-fake-device-for-media-stream',
            '--use-fake-ui-for-media-stream',
            '--ignore-certificate-errors',
          ],
        },
      },
    },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'https://localhost:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
    ignoreHTTPSErrors: true,
  },
});

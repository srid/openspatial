import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false, // Multi-user tests need sequential execution
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1, // Single worker for multi-context tests
  reporter: 'html',
  use: {
    baseURL: 'https://localhost:5173',
    trace: 'on-first-retry',
    ignoreHTTPSErrors: true, // Accept self-signed certs
  },
  projects: [
    {
      name: 'chromium',
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
  ],
  webServer: {
    command: 'npm run dev',
    url: 'https://localhost:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
    ignoreHTTPSErrors: true,
  },
});

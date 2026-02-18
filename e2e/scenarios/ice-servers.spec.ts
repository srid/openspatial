/**
 * ICE Server Configuration Regression Test
 *
 * Verifies the client fetches ICE servers from the server API and uses
 * them for WebRTC peer connections. Catches regressions like the SolidJS
 * migration (f731315) that hardcoded STUN-only and dropped TURN support.
 */
import { test, expect } from '@playwright/test';

test('client fetches ICE servers from /api/ice-servers before creating peer connections', async ({ browser }) => {
  // Track whether the client fetches the ICE servers endpoint
  let iceServersFetched = false;

  const context = await browser.newContext({
    permissions: ['camera', 'microphone'],
    ignoreHTTPSErrors: true,
  });

  const page = await context.newPage();

  // Intercept /api/ice-servers requests to track that the client calls it
  await page.route('**/api/ice-servers', async (route) => {
    iceServersFetched = true;
    // Let the request continue to the real server
    await route.continue();
  });

  // Join a space
  await page.goto('/s/ice-test');
  await page.locator('#join-form').waitFor({ state: 'visible', timeout: 10000 });
  await page.fill('#username', 'IceTester');
  await page.locator('#join-form').evaluate((form: HTMLFormElement) => form.requestSubmit());
  await expect(page.locator('#control-bar')).toBeVisible({ timeout: 10000 });

  // The client should have fetched ICE servers before establishing WebRTC
  expect(iceServersFetched).toBe(true);

  await context.close();
});

test('GET /api/ice-servers returns valid ICE server config', async ({ browser }) => {
  const context = await browser.newContext({ ignoreHTTPSErrors: true });
  const page = await context.newPage();

  // Navigate into the SPA so we have a valid origin
  await page.goto('/s/ice-api-test');
  await page.locator('#join-form').waitFor({ state: 'visible', timeout: 10000 });

  // Use Playwright's request API (respects context's TLS settings)
  const response = await context.request.get('/api/ice-servers');
  expect(response.ok()).toBe(true);

  const servers = await response.json();
  expect(Array.isArray(servers)).toBe(true);
  expect(servers.length).toBeGreaterThan(0);

  // Each entry should have a `urls` field
  for (const server of servers) {
    expect(server).toHaveProperty('urls');
  }

  await context.close();
});

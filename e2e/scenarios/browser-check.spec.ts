import { test, expect } from '@playwright/test';

test('warning banner appears on non-Chrome browser (simulated Firefox)', async ({ browser }) => {
  // Simulate Firefox user agent
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:109.0) Gecko/20100101 Firefox/109.0',
    ignoreHTTPSErrors: true,
  });
  const page = await context.newPage();

  await page.goto('/');

  // Warning should be visible
  const warning = page.locator('.browser-warning');
  await expect(warning).toBeVisible();
  await expect(warning).toHaveText('Warning: This application is tested on Chrome only. You may experience issues on other browsers.');

  // Check CSS properties to ensure it looks right
  await expect(warning).toHaveCSS('background-color', 'rgb(245, 158, 11)'); // #f59e0b is var(--color-warning)
  await expect(warning).toHaveCSS('color', 'rgb(0, 0, 0)');
  await expect(warning).toHaveCSS('font-weight', '700');

  await context.close();
});

test('warning banner does not appear on Chrome', async ({ browser }) => {
  // Simulate Chrome user agent
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/110.0.0.0 Safari/537.36',
    ignoreHTTPSErrors: true,
  });
  const page = await context.newPage();

  await page.goto('/');

  // Warning should NOT be visible
  const warning = page.locator('.browser-warning');
  await expect(warning).not.toBeVisible();

  await context.close();
});

/**
 * Autojoin Feature
 *
 * Verifies that navigating to /s/<space>?autoJoin automatically joins
 * when a saved username exists in localStorage, and falls back to the
 * manual join form when no username is saved.
 */
import { test, expect } from '@playwright/test';

test('auto-joins when ?autoJoin is set and username is saved', async ({ browser }) => {
  const context = await browser.newContext({
    permissions: ['camera', 'microphone'],
    ignoreHTTPSErrors: true,
  });
  const page = await context.newPage();

  // Pre-set username in localStorage by visiting the page first
  await page.goto('/');
  await page.evaluate(() => {
    localStorage.setItem('openspatial-username', 'AutoJoiner');
  });

  // Navigate with ?autoJoin
  await page.goto('/s/autojoin-test-1?autoJoin');

  // Should auto-join — control bar visible without clicking Join
  await expect(page.locator('#control-bar')).toBeVisible({ timeout: 10000 });

  // Verify we're in the space (self avatar should exist)
  await expect(page.locator('.avatar.self')).toBeVisible({ timeout: 10000 });

  await context.close();
});

test('shows join form when ?autoJoin is set but no username saved', async ({ browser }) => {
  const context = await browser.newContext({
    permissions: ['camera', 'microphone'],
    ignoreHTTPSErrors: true,
  });
  const page = await context.newPage();

  // Navigate with ?autoJoin but NO saved username
  await page.goto('/s/autojoin-test-2?autoJoin');

  // Should show the join form (not auto-join)
  await expect(page.locator('#join-form')).toBeVisible({ timeout: 10000 });

  // Username field should be empty
  await expect(page.locator('#username')).toHaveValue('');

  // Control bar should NOT be visible (still on join screen)
  await expect(page.locator('#control-bar')).not.toBeVisible();

  await context.close();
});

/**
 * Remember Name Feature
 * 
 * Verifies that the username is persisted to localStorage and restored on reload.
 */
import { test, expect } from '@playwright/test';

test('remembers username after joining and reloading', async ({ browser }) => {
  const context = await browser.newContext({
    permissions: ['camera', 'microphone'],
    ignoreHTTPSErrors: true,
  });
  const page = await context.newPage();
  
  // Go to the tmp space (auto-created on server start)
  await page.goto('/s/tmp');
  
  // Initially username should be empty
  const usernameInput = page.locator('#username');
  await expect(usernameInput).toHaveValue('');
  
  // Fill in and join (space ID is in URL, not a form field)
  await usernameInput.fill('TestUser');
  await page.locator('#join-form').evaluate((form: HTMLFormElement) => form.requestSubmit());
  
  // Wait for join to complete
  await expect(page.locator('#control-bar')).toBeVisible({ timeout: 10000 });
  
  // Leave the space
  await page.click('#btn-leave');
  
  // Wait for the join modal to be visible again
  await expect(page.locator('#join-modal')).toBeVisible();
  
  // The username input should still have the value (from localStorage)
  await expect(page.locator('#username')).toHaveValue('TestUser');
  
  // Reload the page to verify localStorage persistence across page loads
  await page.reload();
  
  // Username should be restored from localStorage
  await expect(page.locator('#username')).toHaveValue('TestUser');
  
  await context.close();
});

test('space URL remains after leaving', async ({ browser }) => {
  const context = await browser.newContext({
    permissions: ['camera', 'microphone'],
    ignoreHTTPSErrors: true,
  });
  const page = await context.newPage();
  
  // Navigate to tmp space (must be predefined)
  await page.goto('/s/tmp');
  
  // Join the space
  await page.fill('#username', 'UrlTestUser');
  await page.locator('#join-form').evaluate((form: HTMLFormElement) => form.requestSubmit());
  await expect(page.locator('#control-bar')).toBeVisible({ timeout: 10000 });
  
  // Verify we're at the space URL
  expect(page.url()).toContain('/s/tmp');
  
  // Leave the space
  await page.click('#btn-leave');
  await expect(page.locator('#join-modal')).toBeVisible();
  
  // URL should still be the space URL
  expect(page.url()).toContain('/s/tmp');
  
  await context.close();
});

test('document title includes space name on space URL', async ({ browser }) => {
  const context = await browser.newContext({
    permissions: ['camera', 'microphone'],
    ignoreHTTPSErrors: true,
  });
  const page = await context.newPage();
  
  // Navigate to tmp space (predefined)
  await page.goto('/s/tmp');
  
  // Title should include space name
  await expect(page).toHaveTitle('tmp - OpenSpatial');
  
  await context.close();
});

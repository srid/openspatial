/**
 * Remember Name Feature
 * 
 * Verifies that the username is persisted to localStorage and restored on reload.
 */
import { test, expect } from '@playwright/test';

test('remembers username after joining and reloading', async ({ browser }) => {
  const context = await browser.newContext({
    permissions: ['camera', 'microphone'],
  });
  const page = await context.newPage();
  
  // Go to the app
  await page.goto('/');
  
  // Initially username should be empty
  const usernameInput = page.locator('#username');
  await expect(usernameInput).toHaveValue('');
  
  // Fill in and join
  await usernameInput.fill('TestUser');
  await page.fill('#space-id', 'remember-name-test');
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

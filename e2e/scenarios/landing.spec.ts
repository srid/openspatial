/**
 * Landing Page and Space Navigation Tests
 * 
 * Tests for the new routing: / = landing page, /s/:spaceId = join modal
 */
import { test, expect } from '@playwright/test';

test('landing page shows Enter Workspace link to /s/tmp', async ({ browser }) => {
  const context = await browser.newContext({
    ignoreHTTPSErrors: true,
  });
  const page = await context.newPage();
  
  // Navigate to landing page
  await page.goto('/');
  
  // Should see landing page with Enter Workspace button
  const enterButton = page.locator('a.btn-primary:has-text("Enter Workspace")');
  await expect(enterButton).toBeVisible();
  
  // Button should link to /s/tmp
  await expect(enterButton).toHaveAttribute('href', '/s/tmp');
  
  await context.close();
});

test('clicking Enter Workspace navigates to /s/tmp join modal', async ({ browser }) => {
  const context = await browser.newContext({
    ignoreHTTPSErrors: true,
  });
  const page = await context.newPage();
  
  // Navigate to landing page
  await page.goto('/');
  
  // Click Enter Workspace
  await page.click('a:has-text("Enter Workspace")');
  
  // Should be at /s/tmp with join modal visible
  await expect(page).toHaveURL(/\/s\/tmp/);
  await expect(page.locator('#join-modal')).toBeVisible();
  await expect(page.locator('#username')).toBeVisible();
  
  await context.close();
});

test('/s/:spaceId shows join modal with space name in title', async ({ browser }) => {
  const context = await browser.newContext({
    ignoreHTTPSErrors: true,
  });
  const page = await context.newPage();
  
  // Navigate directly to a space URL
  await page.goto('/s/tmp');
  
  // Join modal should be visible
  await expect(page.locator('#join-modal')).toBeVisible();
  
  // Title should include space name
  await expect(page).toHaveTitle('tmp - OpenSpatial');
  
  await context.close();
});

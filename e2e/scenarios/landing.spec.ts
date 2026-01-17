/**
 * Landing Page and Space Navigation Tests
 * 
 * Tests for the new routing: / = landing page, /s/:spaceId = join modal
 */
import { test, expect } from '@playwright/test';

test('landing page shows Try Demo link to /s/tmp', async ({ browser }) => {
  const context = await browser.newContext({
    ignoreHTTPSErrors: true,
  });
  const page = await context.newPage();
  
  // Navigate to landing page
  await page.goto('/');
  
  // Should see landing page with Try Demo button
  const demoButton = page.locator('a.btn-primary:has-text("Try Demo")');
  await expect(demoButton).toBeVisible();
  
  // Button should link to /s/tmp
  await expect(demoButton).toHaveAttribute('href', '/s/tmp');
  
  await context.close();
});

test('clicking Try Demo navigates to /s/tmp join modal', async ({ browser }) => {
  const context = await browser.newContext({
    ignoreHTTPSErrors: true,
  });
  const page = await context.newPage();
  
  // Navigate to landing page
  await page.goto('/');
  
  // Click Try Demo
  await page.click('a:has-text("Try Demo")');
  
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

test('landing page has GitHub link', async ({ browser }) => {
  const context = await browser.newContext({
    ignoreHTTPSErrors: true,
  });
  const page = await context.newPage();
  
  await page.goto('/');
  
  // GitHub button should be visible and link to repo
  const githubLink = page.locator('a:has-text("GitHub")');
  await expect(githubLink).toBeVisible();
  await expect(githubLink).toHaveAttribute('href', 'https://github.com/srid/openspatial');
  await expect(githubLink).toHaveAttribute('target', '_blank');
  
  await context.close();
});

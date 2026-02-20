/**
 * Landing Page and Space Navigation Tests
 * 
 * Tests for the new routing: / = landing page, /s/:spaceId = join modal
 */
import { test, expect } from '@playwright/test';

test('landing page shows space entry form with Enter Space button', async ({ browser }) => {
  const context = await browser.newContext({
    ignoreHTTPSErrors: true,
  });
  const page = await context.newPage();
  
  // Navigate to landing page
  await page.goto('/');
  
  // Should see landing page with space input and Enter Space button
  await expect(page.locator('#landing-space-input')).toBeVisible();
  const enterButton = page.locator('[data-testid="enter-space-btn"]');
  await expect(enterButton).toBeVisible();
  
  await context.close();
});

test('submitting empty form navigates to /s/demo', async ({ browser }) => {
  const context = await browser.newContext({
    ignoreHTTPSErrors: true,
  });
  const page = await context.newPage();
  
  // Navigate to landing page
  await page.goto('/');
  
  // Just click Enter Space without typing anything
  await page.click('[data-testid="enter-space-btn"]');
  
  // Should be at /s/demo with join modal visible
  await expect(page).toHaveURL(/\/s\/demo/);
  await expect(page.locator('#join-modal')).toBeVisible();
  
  await context.close();
});

test('entering custom space name navigates to that space', async ({ browser }) => {
  const context = await browser.newContext({
    ignoreHTTPSErrors: true,
  });
  const page = await context.newPage();
  
  // Navigate to landing page
  await page.goto('/');
  
  // Enter a custom space name
  await page.fill('#landing-space-input', 'my-custom-space');
  await page.click('[data-testid="enter-space-btn"]');
  
  // Should be at the custom space URL
  await expect(page).toHaveURL(/\/s\/my-custom-space/);
  await expect(page.locator('#join-modal')).toBeVisible();
  
  await context.close();
});

test('/s/:spaceId shows join modal with space name in title', async ({ browser }) => {
  const context = await browser.newContext({
    ignoreHTTPSErrors: true,
  });
  const page = await context.newPage();
  
  // Navigate directly to a space URL
  await page.goto('/s/demo');
  
  // Join modal should be visible
  await expect(page.locator('#join-modal')).toBeVisible();
  
  // Title should include space name
  await expect(page).toHaveTitle('demo - OpenSpatial');
  
  await context.close();
});

test('landing page has GitHub link', async ({ browser }) => {
  const context = await browser.newContext({
    ignoreHTTPSErrors: true,
  });
  const page = await context.newPage();
  
  await page.goto('/');
  
  // GitHub link should be visible and link to repo
  const githubLink = page.locator('[data-testid="github-link"]');
  await expect(githubLink).toBeVisible();
  await expect(githubLink).toHaveAttribute('href', 'https://github.com/srid/openspatial');
  await expect(githubLink).toHaveAttribute('target', '_blank');
  
  await context.close();
});

test('arbitrary space URL loads styled SPA (not plain 404)', async ({ browser }) => {
  const context = await browser.newContext({
    ignoreHTTPSErrors: true,
  });
  const page = await context.newPage();
  
  // Navigate directly to an arbitrary space URL.
  // In dev/E2E (autoCreateSpaces=true), the join modal loads normally.
  // In production, the SpaceNotFound component would render instead.
  await page.goto('/s/random-space-abc-123');
  
  // Should see the styled join modal (not a plain text 404)
  await expect(page.locator('#join-modal')).toBeVisible();
  
  // Space name should be displayed
  await expect(page.locator('#space-name-label')).toContainText('random-space-abc-123');
  
  // The "Back to home" link should be visible
  const backLink = page.locator('[data-testid="back-to-home"]');
  await expect(backLink).toBeVisible();
  
  await context.close();
});

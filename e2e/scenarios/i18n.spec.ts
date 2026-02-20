/**
 * i18n E2E Tests
 *
 * Verifies that locale switching works correctly.
 * Sets openspatial-lang in localStorage before loading the page.
 */
import { test, expect } from '@playwright/test';

test('default landing page renders English text', async ({ browser }) => {
  const context = await browser.newContext({
    ignoreHTTPSErrors: true,
  });
  const page = await context.newPage();

  await page.goto('/');

  // Landing page should show English text
  const enterButton = page.locator('[data-testid="enter-space-btn"]');
  await expect(enterButton).toBeVisible();
  await expect(enterButton).toContainText('Enter Space');

  // Tagline should be in English
  await expect(page.getByText('A virtual space where distance disappears')).toBeVisible();

  await context.close();
});

test('French locale renders translated landing page', async ({ browser }) => {
  const context = await browser.newContext({
    ignoreHTTPSErrors: true,
  });
  const page = await context.newPage();

  // Set locale to French via localStorage before navigating
  await page.goto('/');
  await page.evaluate(() => {
    localStorage.setItem('openspatial-lang', 'fr');
  });

  // Reload to pick up the new locale
  await page.reload();

  // Landing page should show French text
  const enterButton = page.locator('[data-testid="enter-space-btn"]');
  await expect(enterButton).toBeVisible();
  await expect(enterButton).toContainText("Entrer dans l'espace");

  // Tagline should be translated
  await expect(page.getByText('Un espace virtuel où la distance disparaît')).toBeVisible();

  await context.close();
});

test('French locale persists across page loads', async ({ browser }) => {
  const context = await browser.newContext({
    ignoreHTTPSErrors: true,
  });
  const page = await context.newPage();

  // Set locale to French
  await page.goto('/');
  await page.evaluate(() => {
    localStorage.setItem('openspatial-lang', 'fr');
  });
  await page.reload();

  // Verify French
  await expect(page.locator('[data-testid="enter-space-btn"]')).toContainText("Entrer dans l'espace");

  // Navigate away and come back
  await page.goto('/s/test-space');
  await page.goto('/');

  // Should still be in French
  await expect(page.locator('[data-testid="enter-space-btn"]')).toContainText("Entrer dans l'espace");

  await context.close();
});

test('join modal shows translated strings in French', async ({ browser }) => {
  const context = await browser.newContext({
    ignoreHTTPSErrors: true,
  });
  const page = await context.newPage();

  // Set locale to French
  await page.goto('/');
  await page.evaluate(() => {
    localStorage.setItem('openspatial-lang', 'fr');
  });

  // Navigate to a space
  await page.goto('/s/demo');

  // Join modal should show French text
  await expect(page.locator('#join-modal')).toBeVisible();
  await expect(page.getByText('Un espace virtuel où la distance disparaît')).toBeVisible();

  // Wait for space check to complete, then verify French labels
  await expect(page.locator('#join-form')).toBeVisible({ timeout: 5000 });
  await expect(page.getByText('Votre nom')).toBeVisible();
  await expect(page.locator('[data-testid="back-to-home"]')).toContainText("Retour à l'accueil");

  await context.close();
});

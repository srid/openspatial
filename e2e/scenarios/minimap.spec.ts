/**
 * Minimap Scenarios
 */
import { expect } from '@playwright/test';
import { scenario } from '../dsl';

scenario('minimap appears with zoom controls', 'minimap-visible', async ({ createUser }) => {
  const user = await createUser('Alex').join();
  
  // Minimap should be visible
  const minimap = user.page.locator('.minimap');
  await expect(minimap).toBeVisible();
  
  // Should have zoom controls
  await expect(user.page.locator('.minimap-controls')).toBeVisible();
  await expect(user.page.locator('.minimap-btn')).toHaveCount(3); // +, -, reset
  
  // Minimap should have viewport indicator
  await expect(user.page.locator('.minimap-viewport')).toBeVisible();
  
  // Minimap should show current user's avatar dot
  await expect(user.page.locator('.minimap-dot-avatar')).toBeVisible();
});

scenario('minimap click pans canvas', 'minimap-pan', async ({ createUser }) => {
  const user = await createUser('Carl').join();
  
  await user.page.waitForSelector('.minimap');
  
  // Get initial space transform
  const getTransform = () => user.page.evaluate(() => {
    const space = document.getElementById('space');
    return space?.style.transform || '';
  });
  
  const initialTransform = await getTransform();
  
  // Click top-left corner of minimap to pan there
  const minimapContent = user.page.locator('.minimap-content');
  
  // Click near top-left of minimap
  await minimapContent.click({ position: { x: 10, y: 10 } });
  
  // Transform should have changed
  await expect.poll(async () => {
    return await getTransform();
  }, { timeout: 2000 }).not.toBe(initialTransform);
});

scenario('minimap zoom controls work', 'minimap-zoom', async ({ createUser }) => {
  const user = await createUser('Dana').join();
  
  await user.page.waitForSelector('.minimap');
  
  // Get initial scale from transform
  const getScale = () => user.page.evaluate(() => {
    const space = document.getElementById('space');
    const match = space?.style.transform.match(/scale\(([^)]+)\)/);
    return match ? parseFloat(match[1]) : 1;
  });
  
  const initialScale = await getScale();
  
  // Click zoom in button
  await user.page.click('.minimap-btn >> text=+');
  
  await expect.poll(async () => {
    return await getScale();
  }, { timeout: 2000 }).toBeGreaterThan(initialScale);
  
  // Click reset button
  await user.page.click('.minimap-btn-reset');
  
  await expect.poll(async () => {
    return await getScale();
  }, { timeout: 2000 }).toBe(1);
});

scenario('minimap shows multiple users', 'minimap-multi-user', async ({ createUser }) => {
  const alice = await createUser('Alice').join();
  const bob = await createUser('Bob').join();
  
  await alice.waitForUser('Bob');
  
  // Alice's minimap should show 2 avatar dots (self + Bob)
  const dots = alice.page.locator('.minimap-dot-avatar');
  await expect(dots).toHaveCount(2);
});

/**
 * Mobile Touch E2E Tests
 * 
 * Tests touch-based interactions on mobile devices.
 * These tests run only with the 'mobile' project (configured via testMatch).
 * 
 * Run with: npx playwright test --project=mobile
 */
import { test, expect } from '@playwright/test';
import { scenario } from '../dsl';

test.describe('mobile touch', () => {

  scenario('mobile touch drag moves avatar', 'mobile-drag-test', async ({ createUser }) => {
    const alice = await createUser('Alice').join();
    
    // Get initial position
    const initialPos = await alice.avatarOf('Alice').position();
    
    // Perform touch drag
    await alice.touchDragAvatar({ dx: 100, dy: 50 });
    
    // Get final position
    const finalPos = await alice.avatarOf('Alice').position();
    
    // Verify position changed (allow some tolerance)
    expect(finalPos.x).toBeGreaterThan(initialPos.x + 50);
    expect(finalPos.y).toBeGreaterThan(initialPos.y + 25);
  });

  scenario('mobile touch drag syncs to other users', 'mobile-sync-test', async ({ createUser }) => {
    const alice = await createUser('Alice').join();
    const bob = await createUser('Bob').join();
    
    // Wait for users to see each other
    await alice.waitForUser('Bob');
    await bob.waitForUser('Alice');
    
    // Get Alice's initial position from Bob's perspective
    const aliceInitialPos = await bob.avatarOf('Alice').position();
    
    // Alice performs touch drag
    await alice.touchDragAvatar({ dx: 75, dy: 25 });
    
    // Wait for sync and verify Bob sees Alice moved
    await expect.poll(async () => {
      const p = await bob.avatarOf('Alice').position();
      return p.x > aliceInitialPos.x + 35 && p.y > aliceInitialPos.y + 10;
    }, { timeout: 5000 }).toBe(true);
  });
});

test.describe('mobile UI', () => {

  test('minimap is hidden on mobile', async ({ page }) => {
    // Navigate to a space and join
    await page.goto('/s/mobile-ui-test');
    await page.fill('#username', 'UITester');
    await page.locator('#join-form').evaluate((form: HTMLFormElement) => form.requestSubmit());
    await page.locator('#control-bar').waitFor({ state: 'visible', timeout: 10000 });
    
    // Verify minimap is not visible on mobile viewport
    const minimap = page.locator('.minimap');
    await expect(minimap).toBeHidden();
  });

  test('control bar is accessible on mobile', async ({ page }) => {
    // Navigate to a space and join
    await page.goto('/s/mobile-controls-test');
    await page.fill('#username', 'ControlTester');
    await page.locator('#join-form').evaluate((form: HTMLFormElement) => form.requestSubmit());
    await page.locator('#control-bar').waitFor({ state: 'visible', timeout: 10000 });
    
    // Verify control bar is visible and clickable
    const controlBar = page.locator('#control-bar');
    await expect(controlBar).toBeVisible();
    
    // Verify we can click the mic button (it should be accessible, not blocked by minimap)
    const micButton = page.locator('#btn-mic');
    await expect(micButton).toBeVisible();
    await micButton.click();
    
    // Verify button state changed (muted class should be added)
    await expect(micButton).toHaveClass(/muted/);
  });

  test('canvas touch pan works', async ({ page }) => {
    // Navigate to a space and join
    await page.goto('/s/mobile-pan-test');
    await page.fill('#username', 'PanTester');
    await page.locator('#join-form').evaluate((form: HTMLFormElement) => form.requestSubmit());
    await page.locator('#control-bar').waitFor({ state: 'visible', timeout: 10000 });
    
    // Get the canvas container
    const container = page.locator('#canvas-container');
    const space = page.locator('#space');
    
    // Get initial transform
    const initialTransform = await space.evaluate((el) => el.style.transform);
    
    // Perform touch pan using CDP
    const box = await container.boundingBox();
    if (box) {
      const client = await page.context().newCDPSession(page);
      const startX = box.x + box.width / 2;
      const startY = box.y + box.height / 2;
      
      await client.send('Input.dispatchTouchEvent', {
        type: 'touchStart',
        touchPoints: [{ x: startX, y: startY }],
      });
      
      // Pan by moving touch
      for (let i = 1; i <= 5; i++) {
        await client.send('Input.dispatchTouchEvent', {
          type: 'touchMove',
          touchPoints: [{ x: startX + i * 20, y: startY + i * 20 }],
        });
      }
      
      await client.send('Input.dispatchTouchEvent', {
        type: 'touchEnd',
        touchPoints: [],
      });
    }
    
    await page.waitForTimeout(500);
    
    // Verify transform changed (canvas panned)
    const finalTransform = await space.evaluate((el) => el.style.transform);
    expect(finalTransform).not.toBe(initialTransform);
  });
});

import { test, expect, Browser, BrowserContext, Page } from '@playwright/test';

/**
 * E2E integration tests for multi-user scenarios.
 * Uses multiple browser contexts to simulate different users.
 */

test.describe('Multi-User Scenarios', () => {
  let userA: { context: BrowserContext; page: Page };
  let userB: { context: BrowserContext; page: Page };

  test.beforeEach(async ({ browser }) => {
    // Create two isolated browser contexts (two users)
    const contextA = await browser.newContext({
      permissions: ['camera', 'microphone'],
      ignoreHTTPSErrors: true,
    });
    const contextB = await browser.newContext({
      permissions: ['camera', 'microphone'],
      ignoreHTTPSErrors: true,
    });

    userA = { context: contextA, page: await contextA.newPage() };
    userB = { context: contextB, page: await contextB.newPage() };
  });

  test.afterEach(async () => {
    await userA.context.close();
    await userB.context.close();
  });

  async function joinSpace(page: Page, username: string, spaceId: string) {
    await page.goto('/');
    await page.fill('#username', username);
    await page.fill('#space-id', spaceId);
    // Submit the form
    await page.locator('#join-form').evaluate((form: HTMLFormElement) => form.requestSubmit());
    // Wait to be in the space (control bar visible means we're in)
    await expect(page.locator('#control-bar')).toBeVisible({ timeout: 10000 });
  }

  test('both users see each other after joining same space', async () => {
    // User A joins
    await joinSpace(userA.page, 'Alice', 'test-room');

    // User B joins same space
    await joinSpace(userB.page, 'Bob', 'test-room');

    // User A should see Bob's avatar
    await expect(userA.page.locator('.avatar:has-text("Bob")')).toBeVisible({ timeout: 10000 });

    // User B should see Alice's avatar
    await expect(userB.page.locator('.avatar:has-text("Alice")')).toBeVisible({ timeout: 10000 });
  });

  test('avatar position updates are synced between users', async () => {
    // Both users join
    await joinSpace(userA.page, 'Alice', 'sync-test');
    await joinSpace(userB.page, 'Bob', 'sync-test');

    // Wait for avatars to appear
    await expect(userA.page.locator('.avatar.self')).toBeVisible();
    await expect(userB.page.locator('.avatar:has-text("Alice")')).toBeVisible({ timeout: 10000 });

    // Get Alice's avatar on User A's page
    const aliceAvatarOnA = userA.page.locator('.avatar.self');

    // Get initial position of Alice's avatar as seen by User B
    const aliceAvatarOnB = userB.page.locator('.avatar:has-text("Alice")');
    const initialLeft = await aliceAvatarOnB.evaluate((el: HTMLElement) => el.style.left);

    // User A drags their avatar
    const box = await aliceAvatarOnA.boundingBox();
    if (box) {
      await userA.page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await userA.page.mouse.down();
      await userA.page.mouse.move(box.x + 100, box.y + 100, { steps: 5 });
      await userA.page.mouse.up();
    }

    // Wait for sync and verify position changed on User B's view
    await userB.page.waitForTimeout(500); // Allow sync time
    const newLeft = await aliceAvatarOnB.evaluate((el: HTMLElement) => el.style.left);

    expect(newLeft).not.toBe(initialLeft);
  });

  test('user leaving removes their avatar from other users view', async () => {
    // Both users join
    await joinSpace(userA.page, 'Alice', 'leave-test');
    await joinSpace(userB.page, 'Bob', 'leave-test');

    // Wait for Alice's avatar to appear on Bob's screen
    await expect(userB.page.locator('.avatar:has-text("Alice")')).toBeVisible({ timeout: 10000 });

    // Alice leaves (click the leave button)
    await userA.page.click('#btn-leave');

    // Bob should no longer see Alice's avatar
    await expect(userB.page.locator('.avatar:has-text("Alice")')).not.toBeVisible({ timeout: 10000 });
  });

  test('participant count updates for both users', async () => {
    // User A joins
    await joinSpace(userA.page, 'Alice', 'count-test');

    // Check initial count (1 participant)
    await expect(userA.page.locator('#participant-count')).toContainText('1');

    // User B joins
    await joinSpace(userB.page, 'Bob', 'count-test');

    // Both should show 2 participants
    await expect(userA.page.locator('#participant-count')).toContainText('2', { timeout: 10000 });
    await expect(userB.page.locator('#participant-count')).toContainText('2');
  });
});


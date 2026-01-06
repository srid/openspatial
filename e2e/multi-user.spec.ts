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

  test('user status updates are synced between users', async () => {
    // Both users join
    await joinSpace(userA.page, 'Alice', 'status-test');
    await joinSpace(userB.page, 'Bob', 'status-test');

    // Wait for both to see each other
    await expect(userA.page.locator('.avatar:has-text("Bob")')).toBeVisible({ timeout: 10000 });
    await expect(userB.page.locator('.avatar:has-text("Alice")')).toBeVisible({ timeout: 10000 });

    // User A sets their status
    await userA.page.fill('#status-input', 'BRB ~10 mins');
    await userA.page.click('#btn-set-status');

    // User A should see their own status
    const aliceAvatarOnA = userA.page.locator('.avatar.self .avatar-status');
    await expect(aliceAvatarOnA).toBeVisible({ timeout: 5000 });
    await expect(aliceAvatarOnA).toContainText('BRB ~10 mins');

    // User B should see Alice's status
    const aliceAvatarOnB = userB.page.locator('.avatar:has-text("Alice") .avatar-status');
    await expect(aliceAvatarOnB).toBeVisible({ timeout: 5000 });
    await expect(aliceAvatarOnB).toContainText('BRB ~10 mins');

    // User A clears their status
    await userA.page.click('#btn-clear-status');

    // User A's status should be hidden
    await expect(aliceAvatarOnA).not.toBeVisible({ timeout: 5000 });

    // User B should no longer see Alice's status
    await expect(aliceAvatarOnB).not.toBeVisible({ timeout: 5000 });
  });

  test('user leaving removes their screen shares from other users view', async () => {
    // Both users join
    await joinSpace(userA.page, 'Alice', 'screenshare-leave-test');
    await joinSpace(userB.page, 'Bob', 'screenshare-leave-test');

    // Wait for both to see each other
    await expect(userA.page.locator('.avatar:has-text("Bob")')).toBeVisible({ timeout: 10000 });
    await expect(userB.page.locator('.avatar:has-text("Alice")')).toBeVisible({ timeout: 10000 });

    // User A starts a screen share
    // We need to mock getDisplayMedia since Playwright can't actually share screens
    await userA.page.evaluate(() => {
      // Create a fake MediaStream with a video track
      const canvas = document.createElement('canvas');
      canvas.width = 640;
      canvas.height = 480;
      const ctx = canvas.getContext('2d')!;
      ctx.fillStyle = 'blue';
      ctx.fillRect(0, 0, 640, 480);
      const stream = canvas.captureStream(30);
      
      // Override getDisplayMedia to return our fake stream
      (navigator.mediaDevices as any).getDisplayMedia = async () => stream;
    });

    // Click the screen share button
    await userA.page.click('#btn-screen');

    // Wait a moment for the share to be established
    await userA.page.waitForTimeout(1000);

    // User B should see a screen share window from Alice
    await expect(userB.page.locator('.screen-share:has-text("Alice")')).toBeVisible({ timeout: 10000 });

    // Alice leaves (click the leave button)
    await userA.page.click('#btn-leave');

    // BUG REPRODUCTION: Bob should NO LONGER see Alice's screen share
    // This test will FAIL if the screen share is not cleaned up when user leaves
    await expect(userB.page.locator('.screen-share:has-text("Alice")')).not.toBeVisible({ timeout: 10000 });
  });

  test('screen share resize is synced between users', async () => {
    // Both users join
    await joinSpace(userA.page, 'Alice', 'screenshare-resize-test');
    await joinSpace(userB.page, 'Bob', 'screenshare-resize-test');

    // Wait for both to see each other
    await expect(userA.page.locator('.avatar:has-text("Bob")')).toBeVisible({ timeout: 10000 });
    await expect(userB.page.locator('.avatar:has-text("Alice")')).toBeVisible({ timeout: 10000 });

    // User A starts a screen share with mock
    await userA.page.evaluate(() => {
      const canvas = document.createElement('canvas');
      canvas.width = 640;
      canvas.height = 480;
      const ctx = canvas.getContext('2d')!;
      ctx.fillStyle = 'green';
      ctx.fillRect(0, 0, 640, 480);
      const stream = canvas.captureStream(30);
      (navigator.mediaDevices as any).getDisplayMedia = async () => stream;
    });

    await userA.page.click('#btn-screen');
    await userA.page.waitForTimeout(1000);

    // User B should see the screen share
    const screenShareOnB = userB.page.locator('.screen-share:has-text("Alice")');
    await expect(screenShareOnB).toBeVisible({ timeout: 10000 });

    // Get initial size on User B
    const initialWidth = await screenShareOnB.evaluate((el: HTMLElement) => el.style.width);

    // User A resizes by dragging the bottom-right corner
    const screenShareOnA = userA.page.locator('.screen-share:has-text("Your Screen")');
    const box = await screenShareOnA.boundingBox();
    if (box) {
      // Simulate resize by dragging from bottom-right corner
      const resizeHandleX = box.x + box.width - 5;
      const resizeHandleY = box.y + box.height - 5;
      
      await userA.page.mouse.move(resizeHandleX, resizeHandleY);
      await userA.page.mouse.down();
      await userA.page.mouse.move(resizeHandleX + 100, resizeHandleY + 100, { steps: 5 });
      await userA.page.mouse.up();
    }

    // Wait for sync
    await userB.page.waitForTimeout(500);

    // BUG REPRODUCTION: User B should see the new size
    // This test will FAIL if resize is not synced
    const newWidth = await screenShareOnB.evaluate((el: HTMLElement) => el.style.width);
    expect(newWidth).not.toBe(initialWidth);
  });

  test('connection status banner responds to offline/online events', async () => {
    // User A joins
    await joinSpace(userA.page, 'Alice', 'connection-test');

    // Verify initial connected state - banner should have 'connected' class
    const connectionStatus = userA.page.locator('#connection-status');
    await expect(connectionStatus).toHaveClass(/connected/, { timeout: 5000 });

    // Simulate going offline
    await userA.page.evaluate(() => {
      window.dispatchEvent(new Event('offline'));
    });

    // Banner should change to disconnected state
    await expect(connectionStatus).toHaveClass(/disconnected/, { timeout: 2000 });

    // Simulate coming back online
    await userA.page.evaluate(() => {
      window.dispatchEvent(new Event('online'));
    });

    // Banner should change back to connected state
    await expect(connectionStatus).toHaveClass(/connected/, { timeout: 2000 });
  });

  test('user can reconnect and share screen after disconnection', async () => {
    // User A joins first
    await joinSpace(userA.page, 'Alice', 'reconnect-test');

    // User B joins same space
    await joinSpace(userB.page, 'Bob', 'reconnect-test');

    // Both users should see each other
    await expect(userA.page.locator('.avatar:has-text("Bob")')).toBeVisible({ timeout: 10000 });
    await expect(userB.page.locator('.avatar:has-text("Alice")')).toBeVisible({ timeout: 10000 });

    // User A goes offline
    await userA.page.evaluate(() => {
      window.dispatchEvent(new Event('offline'));
    });

    // Verify Alice sees disconnected status
    await expect(userA.page.locator('#connection-status')).toHaveClass(/disconnected/, { timeout: 2000 });

    // User A comes back online
    await userA.page.evaluate(() => {
      window.dispatchEvent(new Event('online'));
    });

    // Verify Alice sees connected status
    await expect(userA.page.locator('#connection-status')).toHaveClass(/connected/, { timeout: 2000 });

    // Wait a moment for reconnection to stabilize
    await userA.page.waitForTimeout(500);

    // User A starts a screen share (with mock)
    await userA.page.evaluate(() => {
      const canvas = document.createElement('canvas');
      canvas.width = 640;
      canvas.height = 480;
      const ctx = canvas.getContext('2d')!;
      ctx.fillStyle = 'purple';
      ctx.fillRect(0, 0, 640, 480);
      const stream = canvas.captureStream(30);
      (navigator.mediaDevices as any).getDisplayMedia = async () => stream;
    });

    await userA.page.click('#btn-screen');
    await userA.page.waitForTimeout(1000);

    // User B should see Alice's screen share after reconnection
    await expect(userB.page.locator('.screen-share:has-text("Alice")')).toBeVisible({ timeout: 10000 });
  });
});


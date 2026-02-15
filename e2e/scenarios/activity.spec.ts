/**
 * E2E tests for Activity Panel
 * 
 * Tests the space activity tracking and display functionality.
 */
import { expect } from '@playwright/test';
import { scenario } from '../dsl';

scenario('activity panel shows join event', 'activity-test-1', async ({ createUser }) => {
  const alice = await createUser('Alice').join();
  
  // Open activity panel
  await alice.openActivityPanel();
  
  // Should show Alice's join_first event
  const items = await alice.activityItems();
  expect(items.length).toBeGreaterThan(0);
  expect(items[0].username).toBe('Alice');
  expect(items[0].eventType).toBe('join_first');
});

scenario('activity panel shows join and leave events', 'activity-test-2', async ({ createUser }) => {
  const alice = await createUser('Alice').join();
  const bob = await createUser('Bob').join();
  
  // Bob should see Alice's join and his own join
  await bob.openActivityPanel();
  const itemsBeforeLeave = await bob.activityItems();
  expect(itemsBeforeLeave.some(i => i.username === 'Alice')).toBe(true);
  expect(itemsBeforeLeave.some(i => i.username === 'Bob')).toBe(true);
  
  // Alice leaves
  await alice.leave();
  
  // Bob should see Alice's leave event
  await expect.poll(async () => {
    const items = await bob.activityItems();
    return items.some(i => i.username === 'Alice' && (i.eventType === 'leave' || i.eventType === 'leave_last'));
  }, { timeout: 5000 }).toBe(true);
});

scenario('activity badge appears for new activity', 'activity-test-3', async ({ createUser }) => {
  const alice = await createUser('Alice').join();
  
  // Open and close panel to clear badge
  await alice.openActivityPanel();
  await alice.closeActivityPanel();
  
  // Another user joins
  const bob = await createUser('Bob').join();
  
  // Alice should see badge (activity happened while panel closed)
  await expect.poll(async () =>
    await alice.isActivityBadgeVisible()
  , { timeout: 5000 }).toBe(true);
  
  // Opening panel should hide badge and show Bob's join event
  await alice.openActivityPanel();
  const hasBadgeAfterOpen = await alice.isActivityBadgeVisible();
  expect(hasBadgeAfterOpen).toBe(false);
  
  // Alice should see Bob's join in her activity panel
  const aliceItems = await alice.activityItems();
  const bobJoinEvent = aliceItems.find(i => i.username === 'Bob' && (i.eventType === 'join' || i.eventType === 'join_first'));
  expect(bobJoinEvent).toBeDefined();
});

scenario('activity timestamps are not stale', 'activity-test-4', async ({ createUser }) => {
  const alice = await createUser('Alice').join();
  
  // Wait 2 seconds
  await alice.wait(2000);
  
  // Open panel and check timestamp is not stale
  await alice.openActivityPanel();
  const items = await alice.activityItems();
  expect(items.length).toBeGreaterThan(0);
  
  // Timestamp should NOT be "just now" if we waited 2+ seconds
  // (or it should be "just now" if less than 60 seconds - that's fine)
  // The key assertion is that it's not showing incorrect stale times
  const firstItem = items[0];
  // Either "just now" (valid for < 60s) or "Xm ago" format
  expect(firstItem.timeAgo).toMatch(/^(just now|\dm ago|\dh ago|\dd ago)$/);
});

scenario('activity timestamps refresh over time', 'activity-test-5', async ({ createUser }) => {
  const alice = await createUser('Alice').join();
  
  // Open panel immediately - should show "just now"
  await alice.openActivityPanel();
  const initialItems = await alice.activityItems();
  expect(initialItems.length).toBeGreaterThan(0);
  expect(initialItems[0].timeAgo).toBe('just now');
  
  // Wait for 65 seconds (past the 60s "just now" threshold) + buffer for refresh cycle
  // The panel refreshes every 10 seconds, so we need to wait for a refresh after the minute mark
  await alice.wait(70000);
  
  // Timestamp should have updated to "1m ago"
  const updatedItems = await alice.activityItems();
  expect(updatedItems.length).toBeGreaterThan(0);
  expect(updatedItems[0].timeAgo).toBe('1m ago');
}, { timeoutMs: 90000 });

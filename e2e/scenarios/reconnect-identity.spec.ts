/**
 * Reconnection Identity Tests
 *
 * Verify the two-tier identity model: reconnections silently rotate the
 * Peer ID without generating spurious leave/join notifications.
 */
import { expect } from '@playwright/test';
import { scenario, SYNC_TIMEOUT } from '../dsl';

scenario('reconnection does not generate leave/join activity', 'reconnect-no-activity', async ({ createUser }) => {
  const alice = await createUser('Alice').join();
  const bob = await createUser('Bob').join();
  await bob.waitForUser('Alice');

  // Record activity count before reconnect
  await bob.openActivityPanel();
  const beforeItems = await bob.activityItems();
  const aliceLeavesBefore = beforeItems.filter(i => i.username === 'Alice' && (i.eventType === 'leave' || i.eventType === 'leave_last')).length;

  // Alice has a network glitch — goOffline triggers Socket.io transport close
  await alice.goOffline();
  await alice.wait(500); // Intentional pause to simulate network outage
  await alice.goOnline();

  // Wait for Alice to fully reconnect
  await expect.poll(async () =>
    await alice.connectionStatus()
  , { timeout: SYNC_TIMEOUT }).toBe('connected');

  // Give the server time to process — if it were going to fire events, it would by now
  await bob.wait(2000);

  // Bob should NOT see any new leave events for Alice
  const afterItems = await bob.activityItems();
  const aliceLeavesAfter = afterItems.filter(i => i.username === 'Alice' && (i.eventType === 'leave' || i.eventType === 'leave_last')).length;
  expect(aliceLeavesAfter).toBe(aliceLeavesBefore);
});

scenario('participant count stable during reconnection', 'reconnect-count', async ({ createUser }) => {
  const alice = await createUser('Alice').join();
  const bob = await createUser('Bob').join();
  await bob.waitForUser('Alice');

  expect(await bob.participantCount()).toBe(2);

  // Alice reconnects
  await alice.goOffline();
  await alice.wait(500); // Intentional pause
  await alice.goOnline();

  // Wait for Alice to fully reconnect
  await expect.poll(async () =>
    await alice.connectionStatus()
  , { timeout: SYNC_TIMEOUT }).toBe('connected');

  // Bob's participant count should stay at 2 (never dropped to 1)
  await expect.poll(async () =>
    await bob.participantCount()
  , { timeout: SYNC_TIMEOUT }).toBe(2);
});

scenario('real leave still generates activity after grace period', 'real-leave-activity', async ({ createUser }) => {
  const alice = await createUser('Alice').join();
  const bob = await createUser('Bob').join();
  await bob.waitForUser('Alice');

  // Alice actually leaves (clicks the Leave button → intentional disconnect)
  await alice.leave();

  // Bob should see a leave event for Alice (intentional leaves bypass grace period)
  await bob.openActivityPanel();
  await expect.poll(async () => {
    const items = await bob.activityItems();
    return items.some(i => i.username === 'Alice' && (i.eventType === 'leave' || i.eventType === 'leave_last'));
  }, { timeout: SYNC_TIMEOUT }).toBe(true);
});

scenario('solo user reconnect does not re-trigger join_first', 'solo-reconnect', async ({ createUser }) => {
  const alice = await createUser('Alice').join();

  // Snapshot join_first count BEFORE reconnect (DB persists across runs)
  await alice.openActivityPanel();
  await expect.poll(async () => {
    const items = await alice.activityItems();
    return items.filter(i => i.eventType === 'join_first').length;
  }, { timeout: SYNC_TIMEOUT }).toBeGreaterThanOrEqual(1);

  const beforeItems = await alice.activityItems();
  const joinFirstBefore = beforeItems.filter(i => i.eventType === 'join_first').length;

  // Alice is the only user — reconnects
  await alice.goOffline();
  await alice.wait(500); // Intentional pause to simulate network outage
  await alice.goOnline();

  // Wait for full reconnection
  await expect.poll(async () =>
    await alice.connectionStatus()
  , { timeout: SYNC_TIMEOUT }).toBe('connected');

  // Give server time to settle
  await alice.wait(2000);

  // join_first count should NOT have increased — reconnection is silent
  const afterItems = await alice.activityItems();
  const joinFirstAfter = afterItems.filter(i => i.eventType === 'join_first').length;
  expect(joinFirstAfter).toBe(joinFirstBefore);
});

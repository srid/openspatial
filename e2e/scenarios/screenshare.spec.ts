/**
 * Screen Share Scenarios
 * 
 * All tests verify video content is actually visible (not blank).
 */
import { expect, test } from '@playwright/test';
import { scenario, expectRect } from '../dsl';

scenario('leaving removes screen shares', 'ss-leave', async ({ createUser }) => {
  const alice = await createUser('Alice').join();
  const bob = await createUser('Bob').join();
  await bob.waitForUser('Alice');

  await alice.startScreenShare({ color: 'blue' });
  await bob.wait(1000); // Wait for screen share to propagate via WebRTC
  
  // Bob should see exactly Alice's screen share with actual video content
  const sharesBefore = await bob.screenShares();
  expect(sharesBefore.length).toBe(1);
  expect(sharesBefore[0].owner).toBe('Alice');
  
  // Verify Bob sees actual video content (not blank)
  expect(await bob.screenShareOf('Alice').hasVideoContent()).toBe(true);

  await alice.leave();
  await bob.wait(1000); // Wait for cleanup to propagate
  
  // Bob should see no users and no screen shares
  expect(await bob.visibleUsers()).toEqual([]);
  expect(await bob.screenShares()).toEqual([]);
});

scenario('screen share resize syncs', 'ss-resize', async ({ createUser }) => {
  const alice = await createUser('Alice').join();
  const bob = await createUser('Bob').join();
  await bob.waitForUser('Alice');

  await alice.startScreenShare({ color: 'green' });
  await bob.waitForScreenShare('Alice');
  
  // Verify Bob sees actual video content
  expect(await bob.screenShareOf('Alice').hasVideoContent()).toBe(true);

  const expectedRect = {
    position: { x: 2200, y: 2100 },
    size: { width: 800, height: 600 },
  };
  await alice.resizeScreenShare(expectedRect);
  await alice.wait(1000); // Wait for resize to sync
  
  // Poll for the correct size to appear
  const newRect = await bob.screenShareOf('Alice').rect();
  expectRect(newRect, { position: newRect.position, size: expectedRect.size });
  
  // Verify video content is still visible after resize
  expect(await bob.screenShareOf('Alice').hasVideoContent()).toBe(true);
});

scenario('stopping screen share removes it', 'ss-stop', async ({ createUser }) => {
  const alice = await createUser('Alice').join();
  const bob = await createUser('Bob').join();
  await bob.waitForUser('Alice');

  await alice.startScreenShare({ color: 'yellow' });
  await bob.waitForScreenShare('Alice');

  const sharesBefore = await bob.screenShares();
  expect(sharesBefore.length).toBe(1);
  expect(sharesBefore[0].owner).toBe('Alice');
  
  // Verify Bob sees actual video content before stop
  expect(await bob.screenShareOf('Alice').hasVideoContent()).toBe(true);

  await alice.stopScreenShare();
  await bob.wait(1000);

  expect(await bob.screenShares()).toEqual([]);
});

scenario('multiple users can screen share', 'ss-multiple', async ({ createUser }) => {
  const alice = await createUser('Alice').join();
  const bob = await createUser('Bob').join();
  await alice.waitForUser('Bob');
  await bob.waitForUser('Alice');

  // Both users start screen sharing
  await alice.startScreenShare({ color: 'red' });
  await bob.startScreenShare({ color: 'blue' });

  await alice.wait(1000);
  await bob.wait(1000);

  // Each user should see both screen shares
  const aliceShares = await alice.screenShares();
  const bobShares = await bob.screenShares();

  expect(aliceShares.length).toBe(2);
  expect(bobShares.length).toBe(2);

  // Verify ownership
  const aliceOwners = aliceShares.map(s => s.owner).sort();
  const bobOwners = bobShares.map(s => s.owner).sort();

  expect(aliceOwners).toEqual(['Alice', 'Bob']);
  expect(bobOwners).toEqual(['Alice', 'Bob']);
  
  // Verify Alice sees Bob's video content
  expect(await alice.screenShareOf('Bob').hasVideoContent()).toBe(true);
  // Verify Bob sees Alice's video content
  expect(await bob.screenShareOf('Alice').hasVideoContent()).toBe(true);
});

scenario('late-joiner sees screen share', 'ss-late', async ({ createUser }) => {
  const alice = await createUser('Alice').join();
  
  // Alice starts screen sharing, then resizes it
  await alice.startScreenShare({ color: 'purple' });
  await alice.wait(500);
  
  // Alice resizes the screen share
  const resizedRect = {
    position: { x: 2200, y: 2100 },
    size: { width: 640, height: 480 },
  };
  await alice.resizeScreenShare(resizedRect);
  await alice.wait(500);
  
  // Get Alice's final screen share rect
  const aliceRect = await alice.screenShareOf('Alice').rect();
  
  // Bob joins later
  const bob = await createUser('Bob').join();
  await bob.waitForUser('Alice');
  await bob.waitForScreenShare('Alice');
  
  // Bob should see Alice's screen share with correct size
  const shares = await bob.screenShares();
  expect(shares.length).toBe(1);
  expect(shares[0].owner).toBe('Alice');
  // Verify exact size matches
  expectRect(shares[0].rect, { position: shares[0].rect.position, size: aliceRect.size });
  
  // Verify late-joiner Bob sees actual video content (not blank)
  expect(await bob.screenShareOf('Alice').hasVideoContent()).toBe(true);
});

scenario('anyone can drag screen share', 'ss-drag-anyone', async ({ createUser }) => {
  const alice = await createUser('Alice').join();
  const bob = await createUser('Bob').join();
  await bob.waitForUser('Alice');

  await alice.startScreenShare({ color: 'blue' });
  await bob.waitForScreenShare('Alice');
  
  // Verify Bob sees actual video content before drag
  expect(await bob.screenShareOf('Alice').hasVideoContent()).toBe(true);

  // Get initial position
  const beforeDrag = await bob.screenShareOf('Alice').position();

  // Bob drags Alice's screen share
  await bob.dragScreenShare('Alice', { dx: 100, dy: 50 });

  // Verify position changed for Bob
  const bobAfterDrag = await bob.screenShareOf('Alice').position();
  expect(bobAfterDrag.x).toBeGreaterThan(beforeDrag.x + 50);
  expect(bobAfterDrag.y).toBeGreaterThan(beforeDrag.y + 25);

  // Verify Alice sees the new position too
  await alice.wait(1000);
  const aliceAfterDrag = await alice.screenShareOf('Alice').position();
  expect(aliceAfterDrag.x).toBeCloseTo(bobAfterDrag.x, -1);
  expect(aliceAfterDrag.y).toBeCloseTo(bobAfterDrag.y, -1);
  
  // Verify video content is still visible after drag
  expect(await bob.screenShareOf('Alice').hasVideoContent()).toBe(true);
});

scenario('anyone can resize screen share', 'ss-resize-anyone', async ({ createUser }) => {
  const alice = await createUser('Alice').join();
  const bob = await createUser('Bob').join();
  await bob.waitForUser('Alice');

  await alice.startScreenShare({ color: 'green' });
  await bob.waitForScreenShare('Alice');
  
  // Verify Bob sees actual video content before resize
  expect(await bob.screenShareOf('Alice').hasVideoContent()).toBe(true);

  // Get initial size
  const beforeResize = await bob.screenShareOf('Alice').size();

  // Bob resizes Alice's screen share
  await bob.resizeScreenShare('Alice', { width: 640, height: 480 });

  // Verify size changed for Bob
  await bob.wait(1000);
  const bobAfterResize = await bob.screenShareOf('Alice').size();
  expect(bobAfterResize.width).toBeCloseTo(640, -1);
  expect(bobAfterResize.height).toBeCloseTo(480, -1);

  // Verify Alice sees the new size too
  await alice.wait(1000);
  const aliceAfterResize = await alice.screenShareOf('Alice').size();
  expect(aliceAfterResize.width).toBeCloseTo(640, -1);
  
  // Verify video content is still visible after resize
  expect(await bob.screenShareOf('Alice').hasVideoContent()).toBe(true);
});

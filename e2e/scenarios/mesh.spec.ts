/**
 * Multi-User Mesh Scenarios
 * 
 * Tests for 3+ users to verify WebRTC mesh handling at scale.
 */
import { expect } from '@playwright/test';
import { scenario, expectPosition } from '../dsl';

scenario('three users see each other', 'mesh-three', async ({ createUser }) => {
  const alice = await createUser('Alice').join();
  const bob = await createUser('Bob').join();
  const charlie = await createUser('Charlie').join();

  // Wait for full mesh discovery
  await alice.waitForUser('Bob');
  await alice.waitForUser('Charlie');
  await bob.waitForUser('Alice');
  await bob.waitForUser('Charlie');
  await charlie.waitForUser('Alice');
  await charlie.waitForUser('Bob');

  // Verify participant counts
  expect(await alice.participantCount()).toBe(3);
  expect(await bob.participantCount()).toBe(3);
  expect(await charlie.participantCount()).toBe(3);

  // Verify visible users
  expect(await alice.visibleUsers()).toEqual(['Bob', 'Charlie']);
  expect(await bob.visibleUsers()).toEqual(['Alice', 'Charlie']);
  expect(await charlie.visibleUsers()).toEqual(['Alice', 'Bob']);
});

scenario('third user leaving updates mesh', 'mesh-leave', async ({ createUser }) => {
  const alice = await createUser('Alice').join();
  const bob = await createUser('Bob').join();
  const charlie = await createUser('Charlie').join();

  await alice.waitForUser('Bob');
  await alice.waitForUser('Charlie');
  await bob.waitForUser('Charlie');

  expect(await alice.participantCount()).toBe(3);

  // Charlie leaves
  await charlie.leave();
  await alice.wait(1000);

  expect(await alice.participantCount()).toBe(2);
  expect(await bob.participantCount()).toBe(2);
  expect(await alice.visibleUsers()).toEqual(['Bob']);
  expect(await bob.visibleUsers()).toEqual(['Alice']);
});

scenario('position syncs across three users', 'mesh-position', async ({ createUser }) => {
  const alice = await createUser('Alice').join();
  const bob = await createUser('Bob').join();
  const charlie = await createUser('Charlie').join();

  // Wait for full mesh - everyone sees everyone
  await alice.waitForUser('Bob');
  await alice.waitForUser('Charlie');
  await bob.waitForUser('Alice');
  await bob.waitForUser('Charlie');
  await charlie.waitForUser('Alice');
  await charlie.waitForUser('Bob');
  
  // Wait for WebRTC mesh to fully stabilize
  await alice.wait(1000);

  // Alice drags her avatar
  await alice.dragAvatar({ dx: 75, dy: 50 });

  // Get Alice's position after drag
  const alicePos = await alice.avatarOf('Alice').position();

  // Both Bob and Charlie should see the exact same position
  // Use longer timeout for 3-user mesh (more WebRTC connections to sync)
  await expectPosition(() => bob.avatarOf('Alice').position(), alicePos, 10000);
  await expectPosition(() => charlie.avatarOf('Alice').position(), alicePos, 10000);
});

scenario('screen share visible to all mesh peers', 'mesh-screenshare', async ({ createUser }) => {
  const alice = await createUser('Alice').join();
  const bob = await createUser('Bob').join();
  const charlie = await createUser('Charlie').join();

  await bob.waitForUser('Alice');
  await charlie.waitForUser('Alice');

  await alice.startScreenShare({ color: 'red' });
  await bob.wait(1000);
  await charlie.wait(1000);

  // Both Bob and Charlie should see Alice's screen share
  const bobShares = await bob.screenShares();
  const charlieShares = await charlie.screenShares();

  expect(bobShares.length).toBe(1);
  expect(bobShares[0].owner).toBe('Alice');
  expect(charlieShares.length).toBe(1);
  expect(charlieShares[0].owner).toBe('Alice');
});

scenario('late-joiner sees existing mesh', 'mesh-late', async ({ createUser }) => {
  const alice = await createUser('Alice').join();
  const bob = await createUser('Bob').join();
  await alice.waitForUser('Bob');
  await bob.waitForUser('Alice');
  
  // Charlie joins later
  const charlie = await createUser('Charlie').join();
  await charlie.waitForUser('Alice');
  await charlie.waitForUser('Bob');
  
  // Charlie should see both existing users
  expect(await charlie.visibleUsers()).toEqual(['Alice', 'Bob']);
  expect(await charlie.participantCount()).toBe(3);
});

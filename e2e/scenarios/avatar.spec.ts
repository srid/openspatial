/**
 * Avatar & User Visibility Scenarios
 */
import { expect } from '@playwright/test';
import { scenario, expectPosition } from '../dsl';

scenario('both users see each other', 'see-each-other', async ({ createUser }) => {
  const alice = await createUser('Alice').join();
  const bob = await createUser('Bob').join();

  await alice.waitForUser('Bob');
  await bob.waitForUser('Alice');

  expect(await alice.visibleUsers()).toEqual(['Bob']);
  expect(await bob.visibleUsers()).toEqual(['Alice']);
});

scenario('existing user sees new joiner position', 'new-joiner-pos', async ({ createUser }) => {
  const alice = await createUser('Alice').join();
  const bob = await createUser('Bob').join();

  await alice.waitForUser('Bob');
  await bob.waitForUser('Alice');
  
  // Bob sees his own position (server-assigned)
  const bobPosSelf = await bob.avatarOf('Bob').position();
  
  // Verify Alice sees Bob at the SAME position Bob sees himself
  await expectPosition(() => alice.avatarOf('Bob').position(), bobPosSelf);
});

scenario('avatar position syncs', 'position-sync', async ({ createUser }) => {
  const alice = await createUser('Alice').join();
  const bob = await createUser('Bob').join();
  await bob.waitForUser('Alice');

  // Alice drags her avatar
  await alice.dragAvatar({ dx: 100, dy: 100 });
  
  // Get Alice's position after drag
  const alicePos = await alice.avatarOf('Alice').position();
  
  // Bob should eventually see the exact same position as Alice
  await expectPosition(() => bob.avatarOf('Alice').position(), alicePos);
});

scenario('leaving removes avatar', 'leave-test', async ({ createUser }) => {
  const alice = await createUser('Alice').join();
  const bob = await createUser('Bob').join();
  await bob.waitForUser('Alice');

  expect(await bob.visibleUsers()).toEqual(['Alice']);
  await alice.leave();
  expect(await bob.visibleUsers()).toEqual([]);
});

scenario('participant count updates', 'count-test', async ({ createUser }) => {
  const alice = await createUser('Alice').join();
  expect(await alice.participantCount()).toBe(1);

  const bob = await createUser('Bob').join();
  expect(await alice.participantCount()).toBe(2);
  expect(await bob.participantCount()).toBe(2);
});

scenario('late-joiner sees avatar position', 'pos-late', async ({ createUser }) => {
  const alice = await createUser('Alice').join();
  
  // Alice moves to a specific position
  await alice.dragAvatar({ dx: 150, dy: 100 });
  const alicePos = await alice.avatarOf('Alice').position();
  
  // Bob joins later
  const bob = await createUser('Bob').join();
  await bob.waitForUser('Alice');
  
  // Bob should see Alice at her moved position
  await expectPosition(() => bob.avatarOf('Alice').position(), alicePos);
});

scenario('refreshing user does not leave ghost avatar', 'refresh-no-ghost', async ({ createUser }) => {
  // Alice joins first
  const alice = await createUser('Alice').join();
  
  // Bob joins and sees Alice
  const bob = await createUser('Bob').join();
  await bob.waitForUser('Alice');
  expect(await bob.visibleUsers()).toEqual(['Alice']);
  
  // Alice leaves (simulating refresh/disconnect)
  await alice.leave();
  
  // Wait for cleanup to propagate
  await expect.poll(async () =>
    (await bob.visibleUsers()).length
  , { timeout: 5000 }).toBe(0);
  
  // Alice rejoins with the same name
  const aliceAgain = await createUser('Alice').join();
  await aliceAgain.waitForUser('Bob');
  
  // Bob should see exactly one Alice, not a ghost + new Alice
  const bobSeesUsers = await bob.visibleUsers();
  expect(bobSeesUsers).toEqual(['Alice']);
  
  // Count the number of "Alice" avatars Bob sees (should be exactly 1)
  // If there's a ghost, there would be 2
  expect(bobSeesUsers.length).toBe(1);
});

scenario('new joiner avatar does not overlap existing avatar', 'no-overlap', async ({ createUser }) => {
  const alice = await createUser('Alice').join();
  const bob = await createUser('Bob').join();
  
  await alice.waitForUser('Bob');
  await bob.waitForUser('Alice');
  
  // Get both avatar positions
  const alicePos = await alice.avatarOf('Alice').position();
  const bobPos = await bob.avatarOf('Bob').position();
  
  // Avatar size is approximately 100x100 (adjust based on actual size)
  // Avatars should not overlap - their positions should differ by at least avatar size
  const distance = Math.sqrt(
    Math.pow(alicePos.x - bobPos.x, 2) + 
    Math.pow(alicePos.y - bobPos.y, 2)
  );
  
  // Minimum distance should be greater than avatar diameter (~100px)
  // Using 80 as a safe threshold to account for some tolerance
  expect(distance).toBeGreaterThan(80);
});

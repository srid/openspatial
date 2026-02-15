/**
 * Audio & Mute Scenarios
 */
import { expect } from '@playwright/test';
import { scenario } from '../dsl';

scenario('mute state syncs', 'mute-sync', async ({ createUser }) => {
  const alice = await createUser('Alice').join();
  const bob = await createUser('Bob').join();
  await bob.waitForUser('Alice');

  // Initially not muted
  expect(await bob.avatarOf('Alice').isMuted()).toBe(false);

  // Alice mutes
  await alice.mute();
  await expect.poll(async () =>
    await bob.avatarOf('Alice').isMuted()
  , { timeout: 5000 }).toBe(true);

  // Alice unmutes
  await alice.unmute();
  await expect.poll(async () =>
    await bob.avatarOf('Alice').isMuted()
  , { timeout: 5000 }).toBe(false);
});

scenario('mute toggle is bidirectional', 'mute-bidirectional', async ({ createUser }) => {
  const alice = await createUser('Alice').join();
  const bob = await createUser('Bob').join();
  await alice.waitForUser('Bob');
  await bob.waitForUser('Alice');

  // Both users mute
  await alice.mute();
  await bob.mute();

  await expect.poll(async () =>
    await alice.avatarOf('Bob').isMuted()
  , { timeout: 5000 }).toBe(true);
  await expect.poll(async () =>
    await bob.avatarOf('Alice').isMuted()
  , { timeout: 5000 }).toBe(true);

  // Both users unmute
  await alice.unmute();
  await bob.unmute();

  await expect.poll(async () =>
    await alice.avatarOf('Bob').isMuted()
  , { timeout: 5000 }).toBe(false);
  await expect.poll(async () =>
    await bob.avatarOf('Alice').isMuted()
  , { timeout: 5000 }).toBe(false);
});

scenario('late-joiner sees mute state', 'audio-late', async ({ createUser }) => {
  const alice = await createUser('Alice').join();
  await alice.mute();
  
  // Bob joins later
  const bob = await createUser('Bob').join();
  await bob.waitForUser('Alice');
  
  // Bob should see Alice as muted
  await expect.poll(async () =>
    await bob.avatarOf('Alice').isMuted()
  , { timeout: 5000 }).toBe(true);
});

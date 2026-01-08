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
  await alice.wait(500);
  expect(await bob.avatarOf('Alice').isMuted()).toBe(true);

  // Alice unmutes
  await alice.unmute();
  await alice.wait(500);
  expect(await bob.avatarOf('Alice').isMuted()).toBe(false);
});

scenario('mute toggle is bidirectional', 'mute-bidirectional', async ({ createUser }) => {
  const alice = await createUser('Alice').join();
  const bob = await createUser('Bob').join();
  await alice.waitForUser('Bob');
  await bob.waitForUser('Alice');

  // Both users mute
  await alice.mute();
  await bob.mute();
  await alice.wait(500);

  expect(await alice.avatarOf('Bob').isMuted()).toBe(true);
  expect(await bob.avatarOf('Alice').isMuted()).toBe(true);

  // Both users unmute
  await alice.unmute();
  await bob.unmute();
  await alice.wait(500);

  expect(await alice.avatarOf('Bob').isMuted()).toBe(false);
  expect(await bob.avatarOf('Alice').isMuted()).toBe(false);
});

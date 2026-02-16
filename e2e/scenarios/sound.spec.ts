/**
 * Sound Effect Scenarios
 */
import { expect } from '@playwright/test';
import { scenario } from '../dsl';

scenario('join sound plays when peer joins', 'sound-join', async ({ createUser }) => {
  const alice = await createUser('Alice').join();
  const bob = await createUser('Bob').join();
  await alice.waitForUser('Bob');

  // Alice should have heard a join sound when Bob appeared
  await expect.poll(async () => {
    const sounds = await alice.soundsPlayed();
    return sounds.includes('join');
  }, { timeout: 5000 }).toBe(true);
});

scenario('leave sound plays when peer leaves', 'sound-leave', async ({ createUser }) => {
  const alice = await createUser('Alice').join();
  const bob = await createUser('Bob').join();
  await alice.waitForUser('Bob');

  await bob.leave();

  // Alice should hear a leave sound when Bob departs
  await expect.poll(async () => {
    const sounds = await alice.soundsPlayed();
    return sounds.includes('leave');
  }, { timeout: 5000 }).toBe(true);
});

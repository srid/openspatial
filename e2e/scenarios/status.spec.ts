/**
 * User Status Scenarios
 */
import { expect } from '@playwright/test';
import { scenario } from '../dsl';

scenario('status updates sync', 'status-sync', async ({ createUser }) => {
  const alice = await createUser('Alice').join();
  const bob = await createUser('Bob').join();
  await bob.waitForUser('Alice');

  await alice.setStatus('BRB ~10 mins');
  expect(await alice.avatarOf('Alice').status()).toBe('BRB ~10 mins');

  // Wait for CRDT sync to Bob
  await expect.poll(async () => {
    return await bob.avatarOf('Alice').status();
  }, { timeout: 5000 }).toBe('BRB ~10 mins');

  await alice.clearStatus();

  // Wait for clear to propagate
  await expect.poll(async () => {
    return await bob.avatarOf('Alice').status();
  }, { timeout: 5000 }).toBeNull();
});

scenario('late-joiner sees status', 'status-late', async ({ createUser }) => {
  const alice = await createUser('Alice').join();
  await alice.setStatus('In a meeting');

  const bob = await createUser('Bob').join();
  await bob.waitForUser('Alice');
  await expect.poll(async () => {
    return await bob.avatarOf('Alice').status();
  }, { timeout: 5000 }).toBe('In a meeting');
});

scenario('late-joiner sees muted', 'muted-late', async ({ createUser }) => {
  const alice = await createUser('Alice').join();
  await alice.mute();

  const bob = await createUser('Bob').join();
  await bob.waitForUser('Alice');
  expect(await bob.avatarOf('Alice').isMuted()).toBe(true);
});

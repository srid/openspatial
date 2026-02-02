/**
 * Background Tune Scenarios
 * 
 * Tests for the ambient background tune that plays when alone in a space.
 */
import { expect } from '@playwright/test';
import { scenario } from '../dsl';

scenario('background tune plays when solo', 'tune-solo', async ({ createUser }) => {
  const alice = await createUser('Alice').join();
  await alice.wait(500);

  // When solo, background tune should be playing
  const isPlaying = await alice.isBackgroundTunePlaying();
  expect(isPlaying).toBe(true);
});

scenario('background tune stops when second user joins', 'tune-stops', async ({ createUser }) => {
  const alice = await createUser('Alice').join();
  await alice.wait(500);
  
  // Solo - tune should be playing
  expect(await alice.isBackgroundTunePlaying()).toBe(true);
  
  // Bob joins
  const bob = await createUser('Bob').join();
  await bob.waitForUser('Alice');
  await alice.waitForUser('Bob');
  await alice.wait(500);
  
  // Now with 2 users, tune should stop
  expect(await alice.isBackgroundTunePlaying()).toBe(false);
  expect(await bob.isBackgroundTunePlaying()).toBe(false);
});

scenario('background tune resumes when going solo again', 'tune-resumes', async ({ createUser }) => {
  const alice = await createUser('Alice').join();
  const bob = await createUser('Bob').join();
  await alice.waitForUser('Bob');
  await bob.waitForUser('Alice');
  await alice.wait(500);
  
  // With 2 users, tune should not play
  expect(await alice.isBackgroundTunePlaying()).toBe(false);
  
  // Bob leaves
  await bob.leave();
  await alice.wait(1000);
  
  // Alice is solo again, tune should resume
  expect(await alice.isBackgroundTunePlaying()).toBe(true);
});

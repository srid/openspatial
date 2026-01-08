/**
 * Avatar & User Visibility Scenarios
 */
import { expect, test } from '@playwright/test';
import { scenario } from '../dsl';

scenario('both users see each other', 'see-each-other', async ({ createUser }) => {
  const alice = await createUser('Alice').join();
  const bob = await createUser('Bob').join();

  await alice.waitForUser('Bob');
  await bob.waitForUser('Alice');

  expect(await alice.visibleUsers()).toEqual(['Bob']);
  expect(await bob.visibleUsers()).toEqual(['Alice']);
});

// FIXME: Flaky - Playwright mouse drag doesn't always trigger avatar drag handlers
// See: https://github.com/srid/openspatial/issues/24
test.skip('avatar position syncs', async () => {
  // Skipped - Position drag test is flaky
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

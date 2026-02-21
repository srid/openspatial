import { expect } from '@playwright/test';
import { scenario, SYNC_TIMEOUT } from '../dsl';

scenario('avatar audio tracking attenuates over distance', 'test-spatial-audio', async ({ createUser }) => {
  const alice = await createUser('Alice').join();
  const bob = await createUser('Bob').join();

  await alice.waitForUser('Bob');
  await bob.waitForUser('Alice');

  // Wait for initial sync, volumes should start at 100
  await expect.poll(async () => {
    return await bob.avatarOf('Alice').audioVolume();
  }, { timeout: SYNC_TIMEOUT }).toBe(100);

  // Bob moves slightly away (e.g. 400px) from Alice
  // Max volume distance is 300, so 400 will cause a drop in volume but keep him onscreen
  await bob.dragAvatar({ dx: 400, dy: 0 });
  
  // Alice handles syncing and her avatar calculates new distance
  // Wait for Bob's client to parse the drop in Alice's volume
  await expect.poll(async () => {
    return await bob.avatarOf('Alice').audioVolume();
  }, { timeout: SYNC_TIMEOUT }).toBeLessThan(100);
  
  const attenuatedVolume = await bob.avatarOf('Alice').audioVolume();
  expect(attenuatedVolume).toBeGreaterThan(0); // Should not be 0 yet

  // Bob moves back to origin
  await bob.dragAvatar({ dx: -400, dy: 0 });

  // Volume should recover back to 100
  await expect.poll(async () => {
    return await bob.avatarOf('Alice').audioVolume();
  }, { timeout: SYNC_TIMEOUT }).toBe(100);
});

/**
 * Avatar Colors Scenarios
 *
 * Tests for unique avatar colours when webcam is off.
 */
import { expect } from '@playwright/test';
import { scenario, SYNC_TIMEOUT } from '../dsl';

scenario('webcam-off avatars have unique colors per user', 'unique-colors', async ({ createUser }) => {
  const alice = await createUser('Alice').withoutWebcam().join();
  const bob = await createUser('Bob').withoutWebcam().join();

  await alice.waitForUser('Bob');
  await bob.waitForUser('Alice');

  // Both webcams are off
  await expect.poll(async () =>
    await alice.avatarOf('Bob').isWebcamOn()
  , { timeout: SYNC_TIMEOUT }).toBe(false);

  // Get avatar hues as seen by Alice
  const aliceHue = await alice.avatarOf('Alice').avatarColor();
  const bobHue = await alice.avatarOf('Bob').avatarColor();

  // Each user should have a non-empty hue
  expect(aliceHue).toBeTruthy();
  expect(bobHue).toBeTruthy();

  // Hues must differ between users
  expect(aliceHue).not.toBe(bobHue);
});

scenario('avatar color is deterministic across sessions', 'color-determinism', async ({ createUser }) => {
  const alice = await createUser('Alice').withoutWebcam().join();
  const bob = await createUser('Bob').withoutWebcam().join();
  await bob.waitForUser('Alice');

  const aliceHueBefore = await bob.avatarOf('Alice').avatarColor();

  // Alice leaves and rejoins
  await alice.leave();
  await expect.poll(async () =>
    (await bob.visibleUsers()).length
  , { timeout: SYNC_TIMEOUT }).toBe(0);

  const aliceAgain = await createUser('Alice').withoutWebcam().join();
  await bob.waitForUser('Alice');

  const aliceHueAfter = await bob.avatarOf('Alice').avatarColor();

  // Same username → same hue
  expect(aliceHueAfter).toBe(aliceHueBefore);
});

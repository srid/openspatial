/**
 * Webcam Scenarios
 */
import { expect } from '@playwright/test';
import { scenario } from '../dsl';

scenario('webcam toggle syncs', 'webcam-toggle', async ({ createUser }) => {
  const alice = await createUser('Alice').join();
  const bob = await createUser('Bob').join();
  await bob.waitForUser('Alice');

  // Initially webcam is ON (video track enabled by default)
  expect(await bob.avatarOf('Alice').isWebcamOn()).toBe(true);

  // Alice turns off webcam
  await alice.toggleWebcam();
  await alice.wait(500);
  expect(await bob.avatarOf('Alice').isWebcamOn()).toBe(false);

  // Alice turns on webcam again
  await alice.toggleWebcam();
  await alice.wait(500);
  expect(await bob.avatarOf('Alice').isWebcamOn()).toBe(true);
});

scenario('late-joiner sees webcam state', 'webcam-late', async ({ createUser }) => {
  const alice = await createUser('Alice').join();
  // Alice turns OFF webcam (it starts ON by default)
  await alice.toggleWebcam();
  await alice.wait(500);

  const bob = await createUser('Bob').join();
  await bob.waitForUser('Alice');
  await bob.wait(500);
  // Bob should see Alice's webcam as OFF
  expect(await bob.avatarOf('Alice').isWebcamOn()).toBe(false);
});

/**
 * Webcam Scenarios
 * 
 * All tests use mocked webcams with animated canvas to verify actual video content.
 */
import { expect } from '@playwright/test';
import { scenario } from '../dsl';

scenario('webcam toggle syncs', 'webcam-toggle', async ({ createUser }) => {
  const alice = await createUser('Alice').withMockedWebcam('red').join();
  const bob = await createUser('Bob').withMockedWebcam('blue').join();
  await bob.waitForUser('Alice');

  // Initially webcam is ON with actual video content
  await expect.poll(async () =>
    await bob.avatarOf('Alice').isWebcamOn()
  , { timeout: 10000 }).toBe(true);
  await expect.poll(async () =>
    await bob.avatarOf('Alice').hasVideoContent()
  , { timeout: 10000 }).toBe(true);

  // Alice turns off webcam
  await alice.toggleWebcam();
  await expect.poll(async () =>
    await bob.avatarOf('Alice').isWebcamOn()
  , { timeout: 5000 }).toBe(false);

  // Alice turns on webcam again
  await alice.toggleWebcam();
  await expect.poll(async () =>
    await bob.avatarOf('Alice').isWebcamOn()
  , { timeout: 10000 }).toBe(true);
  await expect.poll(async () =>
    await bob.avatarOf('Alice').hasVideoContent()
  , { timeout: 10000 }).toBe(true);
});

scenario('late-joiner sees webcam state', 'webcam-late', async ({ createUser }) => {
  const alice = await createUser('Alice').withMockedWebcam('green').join();
  // Alice turns OFF webcam (it starts ON by default)
  await alice.toggleWebcam();

  const bob = await createUser('Bob').withMockedWebcam('yellow').join();
  await bob.waitForUser('Alice');
  // Bob should see Alice's webcam as OFF
  await expect.poll(async () =>
    await bob.avatarOf('Alice').isWebcamOn()
  , { timeout: 5000 }).toBe(false);
});

scenario('webcam video content is visible to peers', 'webcam-content', async ({ createUser }) => {
  const alice = await createUser('Alice').withMockedWebcam('red').join();
  
  const bob = await createUser('Bob').withMockedWebcam('blue').join();
  await bob.waitForUser('Alice');
  
  // Verify Bob sees Alice's webcam is on and has actual video content
  await expect.poll(async () =>
    await bob.avatarOf('Alice').isWebcamOn()
  , { timeout: 10000 }).toBe(true);
  await expect.poll(async () =>
    await bob.avatarOf('Alice').hasVideoContent()
  , { timeout: 10000 }).toBe(true);
});

scenario('first-joiner sees second-joiner avatar video', 'webcam-first-sees-second', async ({ createUser }) => {
  const alice = await createUser('Alice').withMockedWebcam('red').join();
  const bob = await createUser('Bob').withMockedWebcam('blue').join();
  
  // Alice waits for Bob to appear
  await alice.waitForUser('Bob');
  
  // Alice should see Bob's webcam is on and has actual video content
  await expect.poll(async () =>
    await alice.avatarOf('Bob').isWebcamOn()
  , { timeout: 10000 }).toBe(true);
  await expect.poll(async () =>
    await alice.avatarOf('Bob').hasVideoContent()
  , { timeout: 10000 }).toBe(true);
});

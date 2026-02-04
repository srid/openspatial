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
  await bob.wait(1000); // Wait for WebRTC to establish

  // Initially webcam is ON with actual video content
  expect(await bob.avatarOf('Alice').isWebcamOn()).toBe(true);
  expect(await bob.avatarOf('Alice').hasVideoContent()).toBe(true);

  // Alice turns off webcam
  await alice.toggleWebcam();
  await alice.wait(500);
  expect(await bob.avatarOf('Alice').isWebcamOn()).toBe(false);

  // Alice turns on webcam again
  await alice.toggleWebcam();
  await alice.wait(1000);
  expect(await bob.avatarOf('Alice').isWebcamOn()).toBe(true);
  expect(await bob.avatarOf('Alice').hasVideoContent()).toBe(true);
});

scenario('late-joiner sees webcam state', 'webcam-late', async ({ createUser }) => {
  const alice = await createUser('Alice').withMockedWebcam('green').join();
  // Alice turns OFF webcam (it starts ON by default)
  await alice.toggleWebcam();
  await alice.wait(500);

  const bob = await createUser('Bob').withMockedWebcam('yellow').join();
  await bob.waitForUser('Alice');
  await bob.wait(500);
  // Bob should see Alice's webcam as OFF
  expect(await bob.avatarOf('Alice').isWebcamOn()).toBe(false);
});

scenario('webcam video content is visible to peers', 'webcam-content', async ({ createUser }) => {
  const alice = await createUser('Alice').withMockedWebcam('red').join();
  
  const bob = await createUser('Bob').withMockedWebcam('blue').join();
  await bob.waitForUser('Alice');
  await bob.wait(1000); // Wait for WebRTC to establish
  
  // Verify Bob sees Alice's webcam is on and has actual video content
  expect(await bob.avatarOf('Alice').isWebcamOn()).toBe(true);
  expect(await bob.avatarOf('Alice').hasVideoContent()).toBe(true);
});

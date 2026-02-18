/**
 * No-Media Scenarios
 * 
 * Tests for joining a space without granting camera/microphone permissions.
 */
import { expect } from '@playwright/test';
import { scenario, SYNC_TIMEOUT } from '../dsl';

scenario('user joins without media', 'no-media-join', async ({ createUser }) => {
  const alice = await createUser('Alice').withoutWebcam().join();
  const bob = await createUser('Bob').withMockedWebcam('blue').join();
  
  await bob.waitForUser('Alice');
  
  // Alice's webcam should appear off (showing initial letter, not video)
  await expect.poll(async () =>
    await bob.avatarOf('Alice').isWebcamOn()
  , { timeout: SYNC_TIMEOUT }).toBe(false);
  
  // Alice can see Bob
  expect(await alice.visibleUsers()).toEqual(['Bob']);
});

scenario('no-media user can interact with space', 'no-media-interact', async ({ createUser }) => {
  const alice = await createUser('Alice').withoutWebcam().join();
  
  // Alice can create a text note despite having no media
  const note = await alice.createTextNote();
  expect(note).toBeTruthy();
  
  // Alice can edit the note
  await alice.editTextNote('Hello from no-cam Alice');
  await expect.poll(async () => {
    const content = await alice.textNoteOf('any').content();
    return content;
  }, { timeout: SYNC_TIMEOUT }).toContain('Hello from no-cam Alice');
});

scenario('no-media user can re-enable camera', 'no-media-reenable', async ({ createUser }) => {
  const alice = await createUser('Alice').withoutWebcam().join();
  const bob = await createUser('Bob').withMockedWebcam('blue').join();
  await bob.waitForUser('Alice');
  
  // Alice's webcam starts off
  await expect.poll(async () =>
    await bob.avatarOf('Alice').isWebcamOn()
  , { timeout: SYNC_TIMEOUT }).toBe(false);
  
  // Alice restores getUserMedia (simulates granting permission) and clicks camera button
  await alice.enableWebcam('red');
  await alice.toggleWebcam();
  
  // Bob should now see Alice's webcam as ON
  await expect.poll(async () =>
    await bob.avatarOf('Alice').isWebcamOn()
  , { timeout: 10000 }).toBe(true);
});

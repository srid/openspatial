/**
 * Connection & Reconnection Scenarios
 */
import { expect } from '@playwright/test';
import { scenario } from '../dsl';

scenario('connection banner responds', 'conn-test', async ({ createUser }) => {
  const alice = await createUser('Alice').join();
  expect(await alice.connectionStatus()).toBe('connected');

  await alice.goOffline();
  expect(await alice.connectionStatus()).toBe('disconnected');

  await alice.goOnline();
  expect(await alice.connectionStatus()).toBe('connected');
});

scenario('reconnect then screen share', 'reconnect', async ({ createUser }) => {
  const alice = await createUser('Alice').join();
  const bob = await createUser('Bob').join();
  await bob.waitForUser('Alice');

  // Simulate disconnect/reconnect
  await alice.goOffline();
  await alice.wait(500);
  await alice.goOnline();
  await alice.wait(1000); // Wait for reconnection
  
  // Start screen share after reconnection
  await alice.startScreenShare({ color: 'purple' });
  await bob.wait(1000); // Wait for WebRTC

  // Bob should see the screen share
  const shares = await bob.screenShares();
  expect(shares.map(s => s.owner)).toEqual(['Alice']);
});

scenario('reconnected user visible to new joiner', 'reconnect-visibility', async ({ createUser }) => {
  // User A joins with webcam
  const alice = await createUser('Alice').withMockedWebcam('red').join();
  await alice.wait(500);
  
  // User A disconnects
  await alice.goOffline();
  await alice.wait(500);
  
  // User A reconnects
  await alice.goOnline();
  await alice.wait(1000); // Wait for reconnection
  
  // User B joins with webcam
  const bob = await createUser('Bob').withMockedWebcam('blue').join();
  await bob.waitForUser('Alice');
  await bob.wait(1000); // Wait for WebRTC to establish
  
  // Bob should see Alice's webcam with actual video content (not black)
  expect(await bob.avatarOf('Alice').isWebcamOn()).toBe(true);
  expect(await bob.avatarOf('Alice').hasVideoContent()).toBe(true);
  
  // Alice should also see Bob's webcam
  await alice.waitForUser('Bob');
  await alice.wait(1000);
  expect(await alice.avatarOf('Bob').isWebcamOn()).toBe(true);
  expect(await alice.avatarOf('Bob').hasVideoContent()).toBe(true);
});

/**
 * Utility: Verify all canvas elements are present and active for a user
 */
async function verifyAllCanvasElements(
  viewer: import('../dsl').User,
  owner: string,
  options: { webcam: boolean; screenShare: boolean; textNote: string }
) {
  // Check webcam
  expect(await viewer.avatarOf(owner).isWebcamOn()).toBe(options.webcam);
  if (options.webcam) {
    expect(await viewer.avatarOf(owner).hasVideoContent()).toBe(true);
  }
  
  // Check screen share
  if (options.screenShare) {
    const shares = await viewer.screenShares();
    expect(shares.some((s: { owner: string }) => s.owner === owner)).toBe(true);
  }
  
  // Check text note
  if (options.textNote) {
    const notes = await viewer.textNotes();
    expect(notes.some((n: { content: string }) => n.content.includes(options.textNote))).toBe(true);
  }
}

scenario('all canvas elements persist after reconnection', 'reconnect-all-elements', async ({ createUser }) => {
  // User A joins with webcam
  const alice = await createUser('Alice').withMockedWebcam('red').join();
  await alice.wait(500);
  
  // Alice creates all canvas elements
  await alice.startScreenShare({ color: 'purple' });
  await alice.wait(500);
  
  await alice.createTextNote();
  await alice.editTextNote('Hello from Alice!');
  await alice.wait(500);
  
  // User B joins and sees all elements
  const bob = await createUser('Bob').withMockedWebcam('blue').join();
  await bob.waitForUser('Alice');
  await bob.waitForScreenShare('Alice');
  await bob.waitForTextNote();
  await bob.wait(1000);
  
  // Verify Bob sees everything BEFORE disconnect
  await verifyAllCanvasElements(bob, 'Alice', {
    webcam: true,
    screenShare: true,
    textNote: 'Hello from Alice!',
  });
  
  // Alice has network glitch - disconnects
  await alice.goOffline();
  await alice.wait(500);
  
  // Alice reconnects
  await alice.goOnline();
  await alice.wait(2000); // Wait for full reconnection + WebRTC re-establishment
  
  // Verify Alice still sees her own elements
  const aliceScreenShares = await alice.screenShares();
  expect(aliceScreenShares.length).toBeGreaterThan(0);
  
  const aliceNotes = await alice.textNotes();
  expect(aliceNotes.some(n => n.content.includes('Hello from Alice!'))).toBe(true);
  
  // Verify Bob STILL sees Alice's webcam with actual video content
  expect(await bob.avatarOf('Alice').isWebcamOn()).toBe(true);
  expect(await bob.avatarOf('Alice').hasVideoContent()).toBe(true);
  
  // Verify Bob still sees Alice's screen share
  const bobScreenShares = await bob.screenShares();
  expect(bobScreenShares.some(s => s.owner === 'Alice')).toBe(true);
  
  // Verify Bob still sees the text note
  const bobNotes = await bob.textNotes();
  expect(bobNotes.some(n => n.content.includes('Hello from Alice!'))).toBe(true);
  
  // Verify Alice sees Bob's webcam after reconnection
  await alice.waitForUser('Bob');
  await alice.wait(1000);
  expect(await alice.avatarOf('Bob').isWebcamOn()).toBe(true);
  expect(await alice.avatarOf('Bob').hasVideoContent()).toBe(true);
});

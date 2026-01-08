/**
 * Late-Joiner Integration Tests
 * 
 * Comprehensive tests verifying that a late-joiner sees all state from existing users
 * with exact attributes (position, size, status, mute state, webcam state).
 */
import { expect } from '@playwright/test';
import { scenario, expectPosition, expectRect } from '../dsl';

scenario('late-joiner sees complete canvas state', 'late-complete', async ({ createUser }) => {
  // Alice joins and sets up her state
  const alice = await createUser('Alice').join();
  
  // 1. Alice moves her avatar
  await alice.dragAvatar({ dx: 200, dy: 150 });
  const alicePos = await alice.avatarOf('Alice').position();
  
  // 2. Alice mutes herself
  await alice.mute();
  
  // 3. Alice turns off webcam
  await alice.toggleWebcam();
  
  // 4. Alice sets a status
  await alice.setStatus('In a meeting');
  
  // 5. Alice starts and resizes a screen share
  await alice.startScreenShare({ color: 'blue' });
  await alice.wait(500);
  await alice.resizeScreenShare({
    position: { x: 2300, y: 2200 },
    size: { width: 720, height: 540 },
  });
  await alice.wait(500);
  const aliceScreenRect = await alice.screenShareOf('Alice').rect();
  
  // Now Bob joins late
  const bob = await createUser('Bob').join();
  await bob.waitForUser('Alice');
  await bob.waitForScreenShare('Alice');
  await bob.wait(500);
  
  // Verify Bob sees Alice's exact avatar position
  await expectPosition(() => bob.avatarOf('Alice').position(), alicePos);
  
  // Verify Bob sees Alice's mute state
  expect(await bob.avatarOf('Alice').isMuted()).toBe(true);
  
  // Verify Bob sees Alice's webcam state (off)
  expect(await bob.avatarOf('Alice').isWebcamOn()).toBe(false);
  
  // Verify Bob sees Alice's status
  expect(await bob.avatarOf('Alice').status()).toBe('In a meeting');
  
  // Verify Bob sees Alice's screen share with correct size
  const bobScreenRect = await bob.screenShareOf('Alice').rect();
  expect(bobScreenRect.size.width).toBe(aliceScreenRect.size.width);
  expect(bobScreenRect.size.height).toBe(aliceScreenRect.size.height);
});

scenario('late-joiner sees two users with complete state', 'late-mesh', async ({ createUser }) => {
  // Alice and Bob set up their states
  const alice = await createUser('Alice').join();
  const bob = await createUser('Bob').join();
  await alice.waitForUser('Bob');
  await bob.waitForUser('Alice');
  
  // Alice: move, mute, screen share
  await alice.dragAvatar({ dx: 100, dy: 50 });
  await alice.mute();
  await alice.startScreenShare({ color: 'red' });
  await alice.wait(500);
  const alicePos = await alice.avatarOf('Alice').position();
  
  // Bob: move, set status, turn off webcam
  await bob.dragAvatar({ dx: -100, dy: 75 });
  await bob.setStatus('BRB');
  await bob.toggleWebcam();
  await bob.wait(500);
  const bobPos = await bob.avatarOf('Bob').position();
  
  // Charlie joins late
  const charlie = await createUser('Charlie').join();
  await charlie.waitForUser('Alice');
  await charlie.waitForUser('Bob');
  await charlie.waitForScreenShare('Alice');
  await charlie.wait(500);
  
  // Charlie sees both users
  expect(await charlie.visibleUsers()).toEqual(['Alice', 'Bob']);
  expect(await charlie.participantCount()).toBe(3);
  
  // Charlie sees Alice's state (longer timeout for 3-user mesh)
  await expectPosition(() => charlie.avatarOf('Alice').position(), alicePos, 10000);
  expect(await charlie.avatarOf('Alice').isMuted()).toBe(true);
  const charlieAliceShares = await charlie.screenShares();
  expect(charlieAliceShares.length).toBe(1);
  expect(charlieAliceShares[0].owner).toBe('Alice');
  
  // Charlie sees Bob's state (longer timeout for 3-user mesh)
  await expectPosition(() => charlie.avatarOf('Bob').position(), bobPos, 10000);
  expect(await charlie.avatarOf('Bob').status()).toBe('BRB');
  expect(await charlie.avatarOf('Bob').isWebcamOn()).toBe(false);
});

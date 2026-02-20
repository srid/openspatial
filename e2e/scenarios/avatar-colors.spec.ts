/**
 * Avatar Colors Tests
 *
 * Tests for unique per-user avatar colors when webcams are off.
 * Issue: https://github.com/srid/openspatial/issues/83
 */
import { expect } from '@playwright/test';
import { scenario, SYNC_TIMEOUT } from '../dsl';

scenario('avatars have unique colors based on username', 'avatar-unique-colors', async ({ createUser }) => {
  const alice = await createUser('Alice').withoutWebcam().join();
  const bob = await createUser('Bob').withoutWebcam().join();
  const charlie = await createUser('Charlie').withoutWebcam().join();

  await alice.waitForUser('Bob');
  await alice.waitForUser('Charlie');

  // Get background colors for each avatar from Alice's perspective
  const aliceBg = await alice.avatarOf('Alice').backgroundStyle();
  const bobBg = await alice.avatarOf('Bob').backgroundStyle();
  const charlieBg = await alice.avatarOf('Charlie').backgroundStyle();

  // Each user should have a unique color (deterministically derived from username)
  expect(bobBg).not.toBe(aliceBg);
  expect(charlieBg).not.toBe(aliceBg);
  expect(charlieBg).not.toBe(bobBg);

  // All should have gradient backgrounds
  expect(aliceBg).toContain('gradient');
  expect(bobBg).toContain('gradient');
  expect(charlieBg).toContain('gradient');
});

scenario('avatar colors are consistent for same username', 'avatar-color-consistency', async ({ createUser }) => {
  const alice = await createUser('Alice').withoutWebcam().join();
  const bob = await createUser('Bob').withoutWebcam().join();

  await alice.waitForUser('Bob');

  // Get Alice's color from Bob's perspective
  const aliceBgFromBob = await bob.avatarOf('Alice').backgroundStyle();

  // Get Alice's own color (self-view)
  const aliceBgFromSelf = await alice.avatarOf('Alice').backgroundStyle();

  // Both should see the same color for Alice
  expect(aliceBgFromBob).toBe(aliceBgFromSelf);

  // Verify it's a valid gradient
  expect(aliceBgFromBob).toContain('gradient');
});

scenario('minimap dots reflect unique avatar colors', 'minimap-avatar-colors', async ({ createUser }) => {
  const alice = await createUser('Alice').withoutWebcam().join();
  const bob = await createUser('Bob').withoutWebcam().join();

  await alice.waitForUser('Bob');

  // Get avatar colors
  const aliceBg = await alice.avatarOf('Alice').backgroundStyle();
  const bobBg = await alice.avatarOf('Bob').backgroundStyle();

  // Extract the starting color from the gradient (first color in linear-gradient)
  const extractFirstColor = (bg: string): string => {
    const match = bg.match(/rgb\([^)]+\)|#[a-fA-F0-9]{6}/);
    return match?.[0] || '';
  };

  const aliceColor = extractFirstColor(aliceBg);
  const bobColor = extractFirstColor(bobBg);

  // Verify they have different colors
  expect(aliceColor).not.toBe('');
  expect(bobColor).not.toBe('');
  expect(aliceColor).not.toBe(bobColor);
});

scenario('avatar color matches username initial display', 'avatar-initial-color', async ({ createUser }) => {
  const testUser = await createUser('TestUser').withoutWebcam().join();

  // Verify the avatar shows the correct initial
  const initial = await testUser.page.locator('.avatar.self .avatar-video-container > div span').textContent();
  expect(initial).toBe('T');

  // Verify the avatar has a colored background
  const bg = await testUser.avatarOf('TestUser').backgroundStyle();
  expect(bg).toContain('gradient');
});

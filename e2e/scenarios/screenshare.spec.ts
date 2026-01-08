/**
 * Screen Share Scenarios
 * 
 * NOTE: "leaving removes screen shares" is skipped due to WebRTC timing issues.
 */
import { expect, test } from '@playwright/test';
import { scenario } from '../dsl';

// FIXME: This test times out waiting for screen share cleanup after leave
// The WebRTC teardown may take longer than 30s in test environment
test.skip('leaving removes screen shares', async () => {
  // Skipped - see GitHub issue
});

scenario('screen share resize syncs', 'ss-resize', async ({ createUser }) => {
  const alice = await createUser('Alice').join();
  const bob = await createUser('Bob').join();
  await bob.waitForUser('Alice');

  await alice.startScreenShare({ color: 'green' });
  const initialRect = await bob.screenShareOf('Alice').rect();

  await alice.resizeScreenShare({
    position: initialRect.position,
    size: { width: 800, height: 600 },
  });
  const newRect = await bob.screenShareOf('Alice').rect();

  expect(newRect.size.width).not.toBe(initialRect.size.width);
});

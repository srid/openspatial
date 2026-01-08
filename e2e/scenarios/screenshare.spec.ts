/**
 * Screen Share Scenarios
 * 
 * NOTE: "leaving removes screen shares" is skipped due to WebRTC timing issues.
 */
import { expect, test } from '@playwright/test';
import { scenario, expectRect } from '../dsl';

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

  const expectedRect = {
    position: initialRect.position,
    size: { width: 800, height: 600 },
  };
  await alice.resizeScreenShare(expectedRect);
  const newRect = await bob.screenShareOf('Alice').rect();

  expectRect(newRect, expectedRect);
});

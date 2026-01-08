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

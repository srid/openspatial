/**
 * Screen Share Debug Test
 * 
 * Tests if local screen share video content check works.
 */
import { expect, test } from '@playwright/test';
import { scenario, expectRect } from '../dsl';

scenario('local screen share has video content', 'ss-local-debug', async ({ createUser }) => {
  const alice = await createUser('Alice').join();
  
  await alice.startScreenShare({ color: 'blue' });
  await alice.wait(1000);
  
  // Check if Alice can see her OWN screen share with video content
  const shares = await alice.screenShares();
  expect(shares.length).toBe(1);
  expect(shares[0].owner).toBe('Alice');
  
  // This tests if the hasVideoContent check works for the LOCAL screen share
  const hasContent = await alice.screenShareOf('Alice').hasVideoContent();
  console.log(`Local screen share hasVideoContent: ${hasContent}`);
  expect(hasContent).toBe(true);
});

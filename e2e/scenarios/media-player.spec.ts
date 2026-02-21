import { expect } from '@playwright/test';
import { scenario, expectPosition, expectRect, SYNC_TIMEOUT } from '../dsl';

scenario('media player syncs across users', 'test-media-player', async ({ createUser }) => {
  const alice = await createUser('Alice').withoutWebcam().join();
  const bob = await createUser('Bob').withoutWebcam().join();

  await alice.waitForUser('Bob');
  await bob.waitForUser('Alice');

  // Alice spawns a media player
  const testUrl = 'https://www.youtube.com/watch?v=Arqj9TSipQw';
  const playerInfo = await alice.spawnMediaPlayer(testUrl);
  
  // Verify Bob sees the media player
  await bob.waitForMediaPlayer();
  const bobPlayers = await bob.mediaPlayers();
  expect(bobPlayers).toHaveLength(1);
  expect(bobPlayers[0].id).toBe(playerInfo.id);

  // Wait for iframe to initialize the src attribute
  await expect.poll(async () => {
    return await bob.mediaPlayerOf(playerInfo.id).url();
  }, { timeout: SYNC_TIMEOUT }).toContain('Arqj9TSipQw');

  // Verify dragging syncs
  await alice.dragMediaPlayer(playerInfo.id, { dx: 100, dy: 50 });
  
  const expectedPos = {
    x: playerInfo.rect.position.x + 100,
    y: playerInfo.rect.position.y + 50
  };

  // Bob should see the new position
  await expectPosition(
    async () => await bob.mediaPlayerOf(playerInfo.id).rect().then(r => r.position),
    expectedPos,
    SYNC_TIMEOUT
  );

  // Verify resizing syncs
  await bob.resizeMediaPlayer(playerInfo.id, { width: 800, height: 600 });
  
  // Alice should see the new size
  await expect.poll(async () => {
    const rect = await alice.mediaPlayerOf(playerInfo.id).rect();
    return rect.size.width === 800 && rect.size.height === 600;
  }, { timeout: SYNC_TIMEOUT }).toBe(true);

  // Verify spatial audio attenuation
  // Bob reads initial volume
  let initialVolume = await bob.mediaPlayerOf(playerInfo.id).volume();
  
  // Alice moves the Media Player slightly away (e.g. 400px) from Bob to trigger attenuation
  // Max volume distance is 300, so 400 will cause a drop in volume.
  await alice.dragMediaPlayer(playerInfo.id, { dx: 400, dy: 0 });
  
  // Volume should eventually drop below initial volume due to distance
  await expect.poll(async () => {
    return await bob.mediaPlayerOf(playerInfo.id).volume();
  }, { timeout: SYNC_TIMEOUT }).toBeLessThan(initialVolume);

  // Alice deletes the media player
  await alice.deleteMediaPlayer(playerInfo.id);

  // Bob should see it disappear
  await expect.poll(async () => {
    const players = await bob.mediaPlayers();
    return players.length === 0;
  }, { timeout: SYNC_TIMEOUT }).toBe(true);

});

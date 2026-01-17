/**
 * Text Note Persistence Tests
 * 
 * Tests that text notes persist across user leave/rejoin.
 */
import { test, expect } from '@playwright/test';
import { scenario } from '../dsl';

scenario('text notes persist after leaving and rejoining', 'persist-test', async ({ createUser }) => {
  const alice = await createUser('Alice').join();
  
  // Create a text note with unique content
  await alice.createTextNote();
  const uniqueContent = `Persist test ${Date.now()}`;
  await alice.editTextNote(uniqueContent);
  await alice.wait(2000); // Wait for debounced persistence
  
  // Leave the space
  await alice.leave();
  
  // Wait a bit for cleanup
  await alice.wait(1000);
  
  // Rejoin the same space
  const aliceRejoined = await createUser('Alice').join();
  
  // Wait for hydration from SQLite
  await aliceRejoined.waitForTextNote();
  
  // Text note should still exist with same content
  const notes = await aliceRejoined.textNotes();
  expect(notes.length).toBeGreaterThanOrEqual(1);
  
  // Find our note by content
  const ourNote = notes.find(n => n.content === uniqueContent);
  expect(ourNote).toBeDefined();
});

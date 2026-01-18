/**
 * Text Note Persistence Tests
 * 
 * Tests that text notes persist across user leave/rejoin.
 */
import { test, expect } from '@playwright/test';
import { scenario } from '../dsl';

/**
 * This test specifically covers the bug where:
 * 1. User creates a note
 * 2. User leaves (space becomes EMPTY - 0 users)
 * 3. User rejoins
 * 4. Note should still be visible (hydrated from SQLite)
 * 
 * The bug was caused by using Set<string> to track hydrated spaces,
 * which didn't account for Y.Doc destruction when space became empty.
 */
scenario('text notes persist when space becomes empty', 'empty-space-persist', async ({ createUser }) => {
  const alice = await createUser('Alice').join();
  
  // Create a text note with unique content
  await alice.createTextNote();
  const uniqueContent = `Empty space test ${Date.now()}`;
  await alice.editTextNote(uniqueContent);
  await alice.wait(3000); // Wait for debounced persistence (extra time to ensure SQLite write)
  
  // Leave the space - this makes the space EMPTY (0 users)
  await alice.leave();
  
  // Wait significantly longer to ensure:
  // 1. The flush-on-disconnect has written to SQLite
  // 2. y-websocket has had time to destroy the Y.Doc
  await alice.wait(3000);
  
  // Rejoin - the Y.Doc will be recreated, and must be re-hydrated from SQLite
  const aliceRejoined = await createUser('Alice').join();
  
  // Wait for hydration from SQLite
  await aliceRejoined.waitForTextNote();
  
  // Text note should still exist with same content
  const notes = await aliceRejoined.textNotes();
  expect(notes.length).toBeGreaterThanOrEqual(1);
  
  // Find our note by content - this is the critical assertion
  const ourNote = notes.find(n => n.content === uniqueContent);
  expect(ourNote).toBeDefined();
});

/**
 * This test specifically covers the SPA (Single Page App) leave→rejoin flow:
 * 1. User creates a note
 * 2. User leaves via "Leave Space" button (SPA navigation, no page reload)
 * 3. User rejoins via "Join Space" button (same page context)
 * 4. Note should still be visible (hydrated from SQLite)
 * 
 * This catches bugs where client-side state (like existingNoteIds) isn't
 * properly cleared on leave, causing notes to not render on rejoin.
 * 
 * NOTE: This test uses the same User object's rejoin() method, which stays
 * in the same browser page context (unlike createUser().join() which creates
 * a new context, equivalent to a page reload).
 */
scenario('text notes persist after SPA leave and rejoin', 'spa-persist', async ({ createUser }) => {
  const alice = await createUser('Alice').join();
  
  // Create a text note with unique content
  await alice.createTextNote();
  const uniqueContent = `SPA persist test ${Date.now()}`;
  await alice.editTextNote(uniqueContent);
  await alice.wait(3000); // Wait for debounced persistence
  
  // Leave the space via SPA navigation (same page, no reload)
  await alice.leave();
  
  // Wait for server to flush to SQLite and destroy doc
  await alice.wait(3000);
  
  // Rejoin via SPA navigation (same page context - this is the critical difference)
  await alice.rejoin();
  
  // Wait for hydration from SQLite
  await alice.waitForTextNote();
  
  // Text note should still exist with same content
  const notes = await alice.textNotes();
  expect(notes.length).toBeGreaterThanOrEqual(1);
  
  // Find our note by content - this is the critical assertion
  const ourNote = notes.find(n => n.content === uniqueContent);
  expect(ourNote).toBeDefined();
});

/**
 * Text Note Scenarios
 * 
 * Tests for text note (sticky note) functionality.
 * Note: Text notes are now ownerless and persistent (shared by everyone).
 */
import { expect } from '@playwright/test';
import { scenario } from '../dsl';

scenario('creating text note appears on canvas', 'note-create', async ({ createUser }) => {
  const alice = await createUser('Alice').join();
  
  // Create a text note
  const note = await alice.createTextNote();
  
  expect(note.content).toBe(''); // Initially empty
  
  // Should be visible on our own canvas
  const notes = await alice.textNotes();
  expect(notes.length).toBe(1);
});

scenario('text note content syncs to other users', 'note-sync', async ({ createUser }) => {
  const alice = await createUser('Alice').join();
  const bob = await createUser('Bob').join();
  await bob.waitForUser('Alice');

  // Alice creates a text note
  await alice.createTextNote();
  await alice.editTextNote('Hello from Alice!');
  
  // Bob waits for the note to appear
  await bob.waitForTextNote();
  
  // Bob should see the note with the content
  const content = await bob.textNoteOf('any').content();
  expect(content).toBe('Hello from Alice!');
});

scenario('anyone can edit shared text notes', 'note-shared-edit', async ({ createUser }) => {
  const alice = await createUser('Alice').join();
  const bob = await createUser('Bob').join();
  await bob.waitForUser('Alice');

  // Alice creates a text note with content
  await alice.createTextNote();
  await alice.editTextNote('Alice wrote this');
  await bob.waitForTextNote();
  
  // Bob should see an editable textarea (everyone can edit)
  const bobNotes = await bob.textNotes();
  expect(bobNotes.length).toBe(1);
  
  // Bob can edit the note
  await bob.editTextNote('Bob edited this');
  await alice.wait(1000);
  
  // Verify Alice sees Bob's edit
  const aliceContent = await alice.textNoteOf('any').content();
  expect(aliceContent).toBe('Bob edited this');
});

scenario('deleting text note removes it', 'note-delete', async ({ createUser }) => {
  const alice = await createUser('Alice').join();
  const bob = await createUser('Bob').join();
  await bob.waitForUser('Alice');

  // Alice creates then deletes a note
  await alice.createTextNote();
  await bob.waitForTextNote();
  
  const beforeDelete = await bob.textNotes();
  expect(beforeDelete.length).toBe(1);
  
  await alice.deleteTextNote();
  
  // Wait for deletion to propagate via CRDT
  await expect.poll(async () => {
    return (await bob.textNotes()).length;
  }, { timeout: 5000 }).toBe(0);
});

// Note: 'leaving removes text notes' test removed - notes are now persistent

scenario('multiple users can create text notes', 'note-multiple', async ({ createUser }) => {
  const alice = await createUser('Alice').join();
  const bob = await createUser('Bob').join();
  await alice.waitForUser('Bob');
  await bob.waitForUser('Alice');

  // Both create notes
  await alice.createTextNote();
  await alice.editTextNote('Alice note');
  await bob.createTextNote();
  await bob.editTextNote('Bob note');

  await alice.wait(1000);
  await bob.wait(1000);

  // Each should see both notes
  const aliceNotes = await alice.textNotes();
  const bobNotes = await bob.textNotes();

  expect(aliceNotes.length).toBe(2);
  expect(bobNotes.length).toBe(2);
});

scenario('late-joiner sees text notes', 'note-late-join', async ({ createUser }) => {
  const alice = await createUser('Alice').join();
  
  // Alice creates a note before Bob joins
  await alice.createTextNote();
  await alice.editTextNote('Pre-existing note');
  await alice.wait(500);

  // Bob joins later
  const bob = await createUser('Bob').join();
  await bob.waitForUser('Alice');
  await bob.waitForTextNote();

  // Bob should see Alice's pre-existing note with content
  const notes = await bob.textNotes();
  expect(notes.length).toBe(1);
  expect(notes[0].content).toBe('Pre-existing note');
});


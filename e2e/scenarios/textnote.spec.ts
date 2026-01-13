/**
 * Text Note Scenarios
 * 
 * Tests for text note (sticky note) functionality.
 */
import { expect } from '@playwright/test';
import { scenario } from '../dsl';

scenario('creating text note appears on canvas', 'note-create', async ({ createUser }) => {
  const alice = await createUser('Alice').join();
  
  // Create a text note
  const note = await alice.createTextNote();
  
  expect(note.owner).toBe('Alice');
  expect(note.content).toBe(''); // Initially empty
  
  // Should be visible on our own canvas
  const notes = await alice.textNotes();
  expect(notes.length).toBe(1);
  expect(notes[0].owner).toBe('Alice');
});

scenario('text note content syncs to other users', 'note-sync', async ({ createUser }) => {
  const alice = await createUser('Alice').join();
  const bob = await createUser('Bob').join();
  await bob.waitForUser('Alice');

  // Alice creates a text note
  await alice.createTextNote();
  await alice.editTextNote('Hello from Alice!');
  
  // Bob waits for the note to appear
  await bob.waitForTextNote('Alice');
  
  // Bob should see Alice's note with the content
  const content = await bob.textNoteOf('Alice').content();
  expect(content).toBe('Hello from Alice!');
});

scenario('only owner can edit text note', 'note-owner-edit', async ({ createUser }) => {
  const alice = await createUser('Alice').join();
  const bob = await createUser('Bob').join();
  await bob.waitForUser('Alice');

  // Alice creates a text note with content
  await alice.createTextNote();
  await alice.editTextNote('Alice wrote this');
  await bob.waitForTextNote('Alice');
  
  // Bob should see a read-only div, not a textarea (for Alice's note)
  const bobNotes = await bob.textNotes();
  expect(bobNotes.length).toBe(1);
  expect(bobNotes[0].owner).toBe('Alice');
  
  // Verify Bob cannot see a textarea (only owner sees textarea)
  const bobPage = await bob.textNoteOf('Alice');
  const content = await bobPage.content();
  expect(content).toBe('Alice wrote this');
});

scenario('deleting text note removes it', 'note-delete', async ({ createUser }) => {
  const alice = await createUser('Alice').join();
  const bob = await createUser('Bob').join();
  await bob.waitForUser('Alice');

  // Alice creates then deletes a note
  await alice.createTextNote();
  await bob.waitForTextNote('Alice');
  
  const beforeDelete = await bob.textNotes();
  expect(beforeDelete.length).toBe(1);
  
  await alice.deleteTextNote();
  
  // Wait for deletion to propagate via CRDT
  await expect.poll(async () => {
    return (await bob.textNotes()).length;
  }, { timeout: 5000 }).toBe(0);
});

scenario('leaving removes text notes', 'note-leave', async ({ createUser }) => {
  const alice = await createUser('Alice').join();
  const bob = await createUser('Bob').join();
  await bob.waitForUser('Alice');

  // Alice creates a note
  await alice.createTextNote();
  await alice.editTextNote('Temporary note');
  await bob.waitForTextNote('Alice');

  // Verify Bob sees the note
  const beforeLeave = await bob.textNotes();
  expect(beforeLeave.length).toBe(1);

  // Alice leaves
  await alice.leave();

  // Wait for CRDT cleanup to propagate
  await expect.poll(async () => {
    return (await bob.visibleUsers()).length;
  }, { timeout: 5000 }).toBe(0);
  
  await expect.poll(async () => {
    return (await bob.textNotes()).length;
  }, { timeout: 5000 }).toBe(0);
});

scenario('multiple users can have text notes', 'note-multiple', async ({ createUser }) => {
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

  // Verify ownership
  const aliceOwners = aliceNotes.map(n => n.owner).sort();
  const bobOwners = bobNotes.map(n => n.owner).sort();

  expect(aliceOwners).toEqual(['Alice', 'Bob']);
  expect(bobOwners).toEqual(['Alice', 'Bob']);
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
  await bob.waitForTextNote('Alice');

  // Bob should see Alice's pre-existing note with content
  const notes = await bob.textNotes();
  expect(notes.length).toBe(1);
  expect(notes[0].owner).toBe('Alice');
  expect(notes[0].content).toBe('Pre-existing note');
});

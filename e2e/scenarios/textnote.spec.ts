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

scenario('text note position syncs to other users', 'note-drag-sync', async ({ createUser }) => {
  const alice = await createUser('Alice').join();
  const bob = await createUser('Bob').join();
  await bob.waitForUser('Alice');

  // Alice creates a text note
  await alice.createTextNote();
  await bob.waitForTextNote();

  // Get initial position
  const beforeDrag = await bob.textNoteOf('any').rect();

  // Alice drags the note
  await alice.dragTextNote({ dx: 100, dy: 50 });

  // Wait for sync and check position changed
  await expect.poll(async () => {
    const afterDrag = await bob.textNoteOf('any').rect();
    return afterDrag.position.x !== beforeDrag.position.x || 
           afterDrag.position.y !== beforeDrag.position.y;
  }, { timeout: 5000 }).toBe(true);
});

scenario('text note size syncs to other users', 'note-resize-sync', async ({ createUser }) => {
  const alice = await createUser('Alice').join();
  const bob = await createUser('Bob').join();
  await bob.waitForUser('Alice');

  // Alice creates a text note
  await alice.createTextNote();
  await bob.waitForTextNote();

  // Get initial size
  const beforeResize = await bob.textNoteOf('any').rect();
  const targetWidth = beforeResize.size.width + 100;
  const targetHeight = beforeResize.size.height + 50;

  // Alice resizes the note
  await alice.resizeTextNote({ width: targetWidth, height: targetHeight });

  // Wait for sync
  await alice.wait(2000);

  // Verify size changed AND stayed changed (catches shrinking bug)
  const afterResize = await bob.textNoteOf('any').rect();
  expect(afterResize.size.width).toBeGreaterThan(beforeResize.size.width + 50);
  expect(afterResize.size.height).toBeGreaterThan(beforeResize.size.height + 25);
  
  // Wait a bit more to ensure it doesn't shrink back
  await alice.wait(1000);
  const finalSize = await bob.textNoteOf('any').rect();
  expect(finalSize.size.width).toBeCloseTo(afterResize.size.width, -1); // Within 10px
  expect(finalSize.size.height).toBeCloseTo(afterResize.size.height, -1);
});

// ─────────────────────────────────────────────────────────────────
// Style Sync Tests
// ─────────────────────────────────────────────────────────────────

scenario('text note font-size syncs to other users', 'note-fontsize-sync', async ({ createUser }) => {
  const alice = await createUser('Alice').join();
  const bob = await createUser('Bob').join();

  // Alice creates a text note
  await alice.createTextNote();
  await alice.editTextNote('Size test');
  await bob.waitForTextNote();

  // Get initial style
  const beforeStyle = await bob.textNoteOf('any').style();
  expect(beforeStyle.fontSize).toBe('medium'); // Default

  // Alice changes font size to large
  await alice.setTextNoteFontSize('large');
  await alice.wait(1000);

  // Bob should see the updated font size
  const afterStyle = await bob.textNoteOf('any').style();
  expect(afterStyle.fontSize).toBe('large');
});

scenario('text note font-family syncs to other users', 'note-fontfamily-sync', async ({ createUser }) => {
  const alice = await createUser('Alice').join();
  const bob = await createUser('Bob').join();

  // Alice creates a text note
  await alice.createTextNote();
  await alice.editTextNote('Font test');
  await bob.waitForTextNote();

  // Get initial style
  const beforeStyle = await bob.textNoteOf('any').style();
  expect(beforeStyle.fontFamily).toBe('sans'); // Default

  // Alice changes font family to mono
  await alice.setTextNoteFontFamily('mono');
  await alice.wait(1000);

  // Bob should see the updated font family
  const afterStyle = await bob.textNoteOf('any').style();
  expect(afterStyle.fontFamily).toBe('mono');
});

scenario('text note color syncs to other users', 'note-color-sync', async ({ createUser }) => {
  const alice = await createUser('Alice').join();
  const bob = await createUser('Bob').join();

  // Alice creates a text note
  await alice.createTextNote();
  await alice.editTextNote('Color test');
  await bob.waitForTextNote();

  // Get initial color (default is white)
  const beforeStyle = await bob.textNoteOf('any').style();
  
  // Alice changes color to pink (from palette: #f9a8d4)
  await alice.setTextNoteColor('#f9a8d4');
  await alice.wait(1000);

  // Bob should see the updated color (browser returns rgb format)
  const afterStyle = await bob.textNoteOf('any').style();
  expect(afterStyle.color).toBe('rgb(249, 168, 212)');
});

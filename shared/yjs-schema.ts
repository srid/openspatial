/**
 * Shared Yjs document schema for state synchronization.
 * Used by both client and server.
 */
import * as Y from 'yjs';

export interface PeerState {
  username: string;
  x: number;
  y: number;
  isMuted: boolean;
  isVideoOff: boolean;
  status: string;
}

export interface ScreenShareState {
  peerId: string;
  username: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export function getPeersMap(doc: Y.Doc): Y.Map<PeerState> {
  return doc.getMap('peers');
}

export function getScreenSharesMap(doc: Y.Doc): Y.Map<ScreenShareState> {
  return doc.getMap('screenShares');
}

export interface TextNoteState {
  x: number;
  y: number;
  width: number;
  height: number;
  fontSize: 'small' | 'medium' | 'large';
  fontFamily: 'sans' | 'serif' | 'mono';
  color: string;
}

export function getTextNotesMap(doc: Y.Doc): Y.Map<TextNoteState> {
  return doc.getMap('textNotes');
}

/**
 * Get the Y.Text for a specific text note's content.
 * Each note has its own Y.Text keyed by 'note:<noteId>'.
 */
export function getTextNoteText(doc: Y.Doc, noteId: string): Y.Text {
  return doc.getText('note:' + noteId);
}

/**
 * Manage Y.Text observers for text note content changes.
 * Shared between server (persistence) and client (reactivity).
 */
export function createTextNoteObservers(doc: Y.Doc, onChange: (noteId: string) => void) {
  const observers = new Map<string, () => void>();

  function observe(noteId: string) {
    if (observers.has(noteId)) return;
    const ytext = getTextNoteText(doc, noteId);
    const handler = () => onChange(noteId);
    ytext.observe(handler);
    observers.set(noteId, () => ytext.unobserve(handler));
  }

  function unobserve(noteId: string) {
    const cleanup = observers.get(noteId);
    if (cleanup) {
      cleanup();
      observers.delete(noteId);
    }
  }

  function clear() {
    for (const cleanup of observers.values()) cleanup();
    observers.clear();
  }

  return { observe, unobserve, clear };
}

// === Persistence Types ===

export interface Space {
  id: string;
  created_at: string;
}

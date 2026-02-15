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

// === Persistence Types ===

export interface Space {
  id: string;
  created_at: string;
}

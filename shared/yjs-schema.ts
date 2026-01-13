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
  peerId: string;
  username: string;
  content: string;
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

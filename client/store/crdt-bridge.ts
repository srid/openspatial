/**
 * CRDT Bridge
 * Bidirectional sync between CRDT and SolidJS Store.
 * 
 * CRDT → Store: When remote peers change, update store
 * Store → CRDT: When local user acts, broadcast to CRDT
 */
import { createEffect, onCleanup } from 'solid-js';
import type { CRDTManager } from '../modules/crdt.js';
import {
  spaceState,
  localMedia,
  addParticipant,
  updateParticipantPosition,
  updateParticipantMedia,
  updateParticipantStatus,
  removeParticipant,
  addScreenShare,
  updateScreenSharePosition,
  updateScreenShareSize,
  removeScreenShare,
  addTextNote,
  updateTextNotePosition,
  updateTextNoteContent,
  updateTextNoteStyle,
  removeTextNote,
  type Position,
} from './space.js';

let activeCRDT: CRDTManager | null = null;
let cleanupFns: (() => void)[] = [];

/**
 * Connect the CRDT to the store for bidirectional sync.
 */
export function connectCRDT(crdt: CRDTManager): void {
  disconnectCRDT(); // Clean up any existing connection
  activeCRDT = crdt;

  // ==================== CRDT → Store ====================
  
  // Observe peer state changes from CRDT
  crdt.observePeers((peers) => {
    const localId = spaceState.localPeerId;
    
    for (const [peerId, peerState] of peers) {
      // Skip local user - we manage our own state
      if (peerId === localId) continue;
      
      const existing = spaceState.participants[peerId];
      
      if (!existing) {
        // New peer - add to store
        addParticipant({
          id: peerId,
          username: peerState.username,
          position: { x: peerState.x, y: peerState.y },
          isMuted: peerState.isMuted,
          isVideoOff: peerState.isVideoOff,
          isSpeaking: false,
          status: peerState.status || '',
        });
      } else {
        // Existing peer - update position and media state
        updateParticipantPosition(peerId, peerState.x, peerState.y);
        updateParticipantMedia(peerId, peerState.isMuted, peerState.isVideoOff);
        updateParticipantStatus(peerId, peerState.status || '');
      }
    }
    
    // Remove peers that are no longer in CRDT
    const crdtPeerIds = new Set(peers.keys());
    for (const existingId of Object.keys(spaceState.participants)) {
      if (existingId !== localId && !crdtPeerIds.has(existingId)) {
        removeParticipant(existingId);
      }
    }
  });

  // Observe screen shares from CRDT
  crdt.observeScreenShares((shares) => {
    for (const [shareId, shareState] of shares) {
      const existing = spaceState.screenShares[shareId];
      
      if (!existing) {
        // Will be created when stream arrives via WebRTC
        // Just update position/size if it exists
      } else {
        updateScreenSharePosition(shareId, shareState.x, shareState.y);
        updateScreenShareSize(shareId, shareState.width, shareState.height);
      }
    }
  });

  // Observe text notes from CRDT
  const existingNoteIds = new Set<string>();
  
  crdt.observeTextNotes((notes) => {
    const crdtNoteIds = new Set(notes.keys());
    
    // Remove notes that are no longer in CRDT
    for (const noteId of existingNoteIds) {
      if (!crdtNoteIds.has(noteId)) {
        removeTextNote(noteId);
        existingNoteIds.delete(noteId);
      }
    }
    
    // Add or update notes from CRDT
    for (const [noteId, noteState] of notes) {
      if (!existingNoteIds.has(noteId)) {
        addTextNote({
          id: noteId,
          content: noteState.content,
          position: { x: noteState.x, y: noteState.y },
          width: noteState.width,
          height: noteState.height,
          fontSize: noteState.fontSize as 'small' | 'medium' | 'large',
          fontFamily: noteState.fontFamily as 'sans' | 'serif' | 'mono',
          color: noteState.color,
        });
        existingNoteIds.add(noteId);
      } else {
        updateTextNotePosition(noteId, noteState.x, noteState.y);
        updateTextNoteContent(noteId, noteState.content);
        updateTextNoteStyle(
          noteId,
          noteState.fontSize as 'small' | 'medium' | 'large',
          noteState.fontFamily as 'sans' | 'serif' | 'mono',
          noteState.color
        );
      }
    }
  });
}

/**
 * Disconnect CRDT and clean up.
 */
export function disconnectCRDT(): void {
  cleanupFns.forEach(fn => fn());
  cleanupFns = [];
  activeCRDT = null;
}

// ==================== Store → CRDT Actions ====================

/**
 * Broadcast local position change to CRDT.
 */
export function broadcastPosition(x: number, y: number): void {
  const localId = spaceState.localPeerId;
  if (activeCRDT && localId) {
    activeCRDT.updatePosition(localId, x, y);
  }
}

/**
 * Broadcast local media state change to CRDT.
 */
export function broadcastMediaState(): void {
  const localId = spaceState.localPeerId;
  if (activeCRDT && localId) {
    activeCRDT.updateMediaState(localId, localMedia.isMuted, localMedia.isVideoOff);
  }
}

/**
 * Broadcast local status change to CRDT.
 */
export function broadcastStatus(status: string): void {
  const localId = spaceState.localPeerId;
  if (activeCRDT && localId) {
    activeCRDT.updateStatus(localId, status);
  }
}

/**
 * Add local peer to CRDT.
 */
export function addLocalPeerToCRDT(x: number, y: number): void {
  const localId = spaceState.localPeerId;
  if (activeCRDT && localId) {
    activeCRDT.addPeer(localId, spaceState.username, x, y);
  }
}

/**
 * Remove local peer from CRDT (on leave).
 */
export function removeLocalPeerFromCRDT(): void {
  const localId = spaceState.localPeerId;
  if (activeCRDT && localId) {
    activeCRDT.removePeer(localId);
  }
}

// ==================== Screen Share CRDT Actions ====================

export function broadcastScreenSharePosition(shareId: string, x: number, y: number): void {
  activeCRDT?.updateScreenSharePosition(shareId, x, y);
}

export function broadcastScreenShareSize(shareId: string, width: number, height: number): void {
  activeCRDT?.updateScreenShareSize(shareId, width, height);
}

export function addScreenShareToCRDT(
  shareId: string, 
  peerId: string, 
  username: string, 
  x: number, 
  y: number, 
  width: number, 
  height: number
): void {
  activeCRDT?.addScreenShare(shareId, peerId, username, x, y, width, height);
}

export function removeScreenShareFromCRDT(shareId: string): void {
  activeCRDT?.removeScreenShare(shareId);
}

// ==================== Text Note CRDT Actions ====================

export function addTextNoteToCRDT(
  noteId: string,
  content: string,
  x: number,
  y: number,
  width: number,
  height: number,
  fontSize: 'small' | 'medium' | 'large' = 'medium',
  fontFamily: 'sans' | 'serif' | 'mono' = 'sans',
  color: string = '#ffffff'
): void {
  activeCRDT?.addTextNote(noteId, content, x, y, width, height, fontSize, fontFamily, color);
}

export function broadcastTextNotePosition(noteId: string, x: number, y: number): void {
  activeCRDT?.updateTextNotePosition(noteId, x, y);
}

export function broadcastTextNoteSize(noteId: string, width: number, height: number): void {
  activeCRDT?.updateTextNoteSize(noteId, width, height);
}

export function broadcastTextNoteContent(noteId: string, content: string): void {
  activeCRDT?.updateTextNoteContent(noteId, content);
}

export function broadcastTextNoteStyle(
  noteId: string, 
  fontSize: 'small' | 'medium' | 'large', 
  fontFamily: 'sans' | 'serif' | 'mono', 
  color: string
): void {
  activeCRDT?.updateTextNoteStyle(noteId, fontSize, fontFamily, color);
}

export function removeTextNoteFromCRDT(noteId: string): void {
  activeCRDT?.removeTextNote(noteId);
}

// ==================== Getter ====================

export function getCRDT(): CRDTManager | null {
  return activeCRDT;
}

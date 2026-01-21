/**
 * App Store - Reactive state for the OpenSpatial application
 * Uses Solid.js signals as the single source of truth for UI state.
 */
import { createSignal, createMemo } from 'solid-js';
import type { PeerData, Position } from '../../shared/types/events.js';
import { ConnectionStatus } from '../../shared/types/state.js';
import type { ScreenShareState, TextNoteState } from '../../shared/yjs-schema.js';

// Re-export for convenience
export { ConnectionStatus };

// ==================== Connection State ====================

const [connectionStatus, setConnectionStatus] = createSignal<ConnectionStatus>(ConnectionStatus.Disconnected);
const [reconnectAttempt, setReconnectAttempt] = createSignal(0);
const [reconnectMaxAttempts, setReconnectMaxAttempts] = createSignal(0);

export const connection = {
  status: connectionStatus,
  reconnectAttempt,
  reconnectMaxAttempts,
  setStatus: setConnectionStatus,
  setReconnectInfo: (attempt: number, max: number) => {
    setReconnectAttempt(attempt);
    setReconnectMaxAttempts(max);
  },
};

// ==================== User State ====================

const [username, setUsername] = createSignal('');
const [peerId, setPeerId] = createSignal<string | null>(null);
const [spaceId, setSpaceId] = createSignal('');
const [status, setStatus] = createSignal('');

export const user = {
  username,
  setUsername,
  peerId,
  setPeerId,
  spaceId,
  setSpaceId,
  status,
  setStatus,
};

// ==================== Media State ====================

const [isMuted, setIsMuted] = createSignal(false);
const [isVideoOff, setIsVideoOff] = createSignal(false);
const [isScreenSharing, setIsScreenSharing] = createSignal(false);
const [localStream, setLocalStream] = createSignal<MediaStream | null>(null);

export const media = {
  isMuted,
  setIsMuted,
  isVideoOff,
  setIsVideoOff,
  isScreenSharing,
  setIsScreenSharing,
  localStream,
  setLocalStream,
  toggleMute: () => setIsMuted(!isMuted()),
  toggleVideo: () => setIsVideoOff(!isVideoOff()),
};

// ==================== Peers State ====================

const [peers, setPeers] = createSignal<Map<string, PeerData>>(new Map());

export const peersStore = {
  peers,
  setPeers,
  getPeer: (id: string) => peers().get(id),
  updatePeer: (id: string, data: Partial<PeerData>) => {
    setPeers(prev => {
      const next = new Map(prev);
      const existing = next.get(id);
      if (existing) {
        next.set(id, { ...existing, ...data });
      }
      return next;
    });
  },
  addPeer: (id: string, data: PeerData) => {
    setPeers(prev => {
      const next = new Map(prev);
      next.set(id, data);
      return next;
    });
  },
  removePeer: (id: string) => {
    setPeers(prev => {
      const next = new Map(prev);
      next.delete(id);
      return next;
    });
  },
  clear: () => setPeers(new Map()),
};

export const participantCount = createMemo(() => peers().size + 1); // +1 for self

// ==================== UI State ====================

export enum AppView {
  Landing = 'landing',
  Join = 'join',
  Space = 'space',
}

const [currentView, setCurrentView] = createSignal<AppView>(AppView.Landing);
const [joinError, setJoinError] = createSignal<string | null>(null);
const [spaceParticipants, setSpaceParticipants] = createSignal<string[]>([]);
const [isLoadingParticipants, setIsLoadingParticipants] = createSignal(false);

export const ui = {
  currentView,
  setCurrentView,
  joinError,
  setJoinError,
  spaceParticipants,
  setSpaceParticipants,
  isLoadingParticipants,
  setIsLoadingParticipants,
};

// ==================== Screen Shares State ====================

/**
 * UI-specific screen share state that extends shared type with runtime identifier.
 */
export interface ScreenShareUI extends ScreenShareState {
  shareId: string;
}

const [screenShares, setScreenShares] = createSignal<Map<string, ScreenShareUI>>(new Map());

export const screenSharesStore = {
  screenShares,
  setScreenShares,
  add: (state: ScreenShareUI) => {
    setScreenShares(prev => {
      const next = new Map(prev);
      next.set(state.shareId, state);
      return next;
    });
  },
  remove: (shareId: string) => {
    setScreenShares(prev => {
      const next = new Map(prev);
      next.delete(shareId);
      return next;
    });
  },
  update: (shareId: string, updates: Partial<ScreenShareState>) => {
    setScreenShares(prev => {
      const next = new Map(prev);
      const existing = next.get(shareId);
      if (existing) {
        next.set(shareId, { ...existing, ...updates });
      }
      return next;
    });
  },
};

// ==================== Text Notes State ====================

/**
 * UI-specific text note state that extends shared type with runtime identifier.
 */
export interface TextNoteUI extends TextNoteState {
  noteId: string;
}

const [textNotes, setTextNotes] = createSignal<Map<string, TextNoteUI>>(new Map());

export const textNotesStore = {
  textNotes,
  setTextNotes,
  add: (state: TextNoteUI) => {
    setTextNotes(prev => {
      const next = new Map(prev);
      next.set(state.noteId, state);
      return next;
    });
  },
  remove: (noteId: string) => {
    setTextNotes(prev => {
      const next = new Map(prev);
      next.delete(noteId);
      return next;
    });
  },
  update: (noteId: string, updates: Partial<TextNoteState>) => {
    setTextNotes(prev => {
      const next = new Map(prev);
      const existing = next.get(noteId);
      if (existing) {
        next.set(noteId, { ...existing, ...updates });
      }
      return next;
    });
  },
};

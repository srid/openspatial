/**
 * Central reactive state for Solid.js UI.
 * Uses signals for fine-grained reactivity (like Reflex Dynamics).
 */

import { createSignal } from 'solid-js';
import type { PeerData, Position } from '../../shared/types/events.js';

// ==================== Connection State ====================

export enum ConnectionStatus {
  Disconnected = 'disconnected',
  Connecting = 'connecting',
  Connected = 'connected',
  Reconnecting = 'reconnecting',
}

const [connectionStatus, setConnectionStatus] = createSignal<ConnectionStatus>(ConnectionStatus.Disconnected);
const [reconnectAttempt, setReconnectAttempt] = createSignal(0);
const [reconnectMax, setReconnectMax] = createSignal(0);

export const connection = {
  status: connectionStatus,
  setStatus: setConnectionStatus,
  reconnectAttempt,
  reconnectMax,
  setReconnectInfo: (attempt: number, max: number) => {
    setReconnectAttempt(attempt);
    setReconnectMax(max);
  },
};

// ==================== View State ====================

export enum AppView {
  Landing = 'landing',
  Join = 'join',
  Space = 'space',
}

const [currentView, setCurrentView] = createSignal<AppView>(AppView.Landing);
const [joinError, setJoinError] = createSignal<string | null>(null);
const [isLoading, setIsLoading] = createSignal(false);

export const ui = {
  currentView,
  setCurrentView,
  joinError,
  setJoinError,
  isLoading,
  setIsLoading,
};

// ==================== User State ====================

const [username, setUsername] = createSignal('');
const [peerId, setPeerId] = createSignal<string | null>(null);
const [spaceId, setSpaceId] = createSignal('');
const [status, setStatus] = createSignal('');
const [isMuted, setIsMuted] = createSignal(false);
const [isVideoOff, setIsVideoOff] = createSignal(false);

export const user = {
  username,
  setUsername,
  peerId,
  setPeerId,
  spaceId,
  setSpaceId,
  status,
  setStatus,
  isMuted,
  setIsMuted,
  isVideoOff,
  setIsVideoOff,
};

// ==================== Space Info (for join preview) ====================

const [spaceExists, setSpaceExists] = createSignal<boolean | null>(null);
const [spaceParticipants, setSpaceParticipants] = createSignal<string[]>([]);
const [spaceName, setSpaceName] = createSignal('');

export const spaceInfo = {
  exists: spaceExists,
  setExists: setSpaceExists,
  participants: spaceParticipants,
  setParticipants: setSpaceParticipants,
  name: spaceName,
  setName: setSpaceName,
};

// ==================== Collection Stores ====================

// UI-specific projections that include runtime IDs
export interface PeerUI extends PeerData {
  peerId: string;
}

export interface ScreenShareUI {
  shareId: string;
  ownerId: string;
  ownerName: string;
  position: Position;
  width: number;
  height: number;
}

export interface TextNoteUI {
  noteId: string;
  ownerId: string;
  content: string;
  position: Position;
  width: number;
  height: number;
  fontSize: number;
  fontFamily: string;
  color: string;
}

const [peers, setPeers] = createSignal<Map<string, PeerUI>>(new Map());
const [screenShares, setScreenShares] = createSignal<Map<string, ScreenShareUI>>(new Map());
const [textNotes, setTextNotes] = createSignal<Map<string, TextNoteUI>>(new Map());

export const collections = {
  peers,
  setPeers,
  screenShares,
  setScreenShares,
  textNotes,
  setTextNotes,
  
  // Helper to update a single peer
  updatePeer: (id: string, updater: (p: PeerUI) => PeerUI) => {
    setPeers((prev) => {
      const next = new Map(prev);
      const existing = next.get(id);
      if (existing) next.set(id, updater(existing));
      return next;
    });
  },
  
  // Helper to add/remove peers
  addPeer: (id: string, peer: PeerUI) => {
    setPeers((prev) => new Map(prev).set(id, peer));
  },
  
  removePeer: (id: string) => {
    setPeers((prev) => {
      const next = new Map(prev);
      next.delete(id);
      return next;
    });
  },
};

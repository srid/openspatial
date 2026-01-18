/**
 * Shared client application state types.
 * Unified types used across all client modules.
 */

import type { PeerData } from './events.js';

/**
 * Base application state shared across modules.
 * Different modules may only need subsets of this state.
 */
export interface AppState {
  /** Current logged-in username */
  username: string;
  /** Current space ID */
  spaceId: string;
  /** Local peer's server-assigned ID (null before joining) */
  peerId: string | null;
  /** Map of remote peer IDs to their data */
  peers: Map<string, PeerData>;
  /** Local webcam/mic stream */
  localStream: MediaStream | null;
  /** Active screen share streams by shareId */
  screenStreams: Map<string, MediaStream>;
  /** Pending screen share IDs awaiting WebRTC tracks */
  pendingShareIds: Map<string, (string | PendingShareInfo)[]>;
  /** Whether local mic is muted */
  isMuted: boolean;
  /** Whether local video is off */
  isVideoOff: boolean;
  /** Current status message */
  status: string;
}

/**
 * Pending screen share info for late-joining peers.
 */
export interface PendingShareInfo {
  shareId: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Subset of AppState needed by AvatarManager.
 */
export type AvatarAppState = Pick<AppState, 'peerId' | 'username'>;

/**
 * Subset of AppState needed by WebRTCManager.
 */
export type WebRTCAppState = Pick<AppState, 'peerId' | 'localStream' | 'screenStreams' | 'pendingShareIds' | 'peers'>;

/**
 * Subset of AppState needed by ScreenShareManager and TextNoteManager.
 */
export type CanvasElementAppState = Pick<AppState, 'peerId'>;

/**
 * Subset of AppState needed by UIController.
 */
export type UIAppState = Pick<AppState, 'isMuted' | 'isVideoOff'>;

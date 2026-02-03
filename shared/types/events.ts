/**
 * Shared types for socket events between client and server.
 * IMPORTANT: Both client and server import from here to ensure type safety.
 */

// ==================== Peer/Avatar Events ====================

export interface Position {
  x: number;
  y: number;
}

export interface PeerData {
  username: string;
  position: Position;
  isMuted: boolean;
  isVideoOff: boolean;
  isScreenSharing: boolean;
  status?: string;
}

export interface ScreenShareData {
  peerId: string;
  username: string;
  // NOTE: Position and size are managed by CRDT, not Socket.io
}

// ==================== Socket Events (Client -> Server) ====================

export interface JoinSpaceEvent {
  spaceId: string;
  username: string;
}

export interface SignalEvent {
  to: string;
  from: string;
  signal: {
    type: 'offer' | 'answer' | 'candidate';
    sdp?: RTCSessionDescriptionInit;
    candidate?: RTCIceCandidateInit;
  };
}

// NOTE: PositionUpdateEvent, MediaStateUpdateEvent, StatusUpdateEvent,
// ScreenSharePositionUpdateEvent, ScreenShareResizeUpdateEvent have been
// removed. These state updates are now handled by Yjs CRDT, not Socket.io.

export interface ScreenShareStartedEvent {
  peerId: string;
  shareId: string;
  // Position is managed by CRDT
}

export interface ScreenShareStoppedEvent {
  peerId: string;
  shareId: string;
}

// ==================== Socket Events (Server -> Client) ====================

export interface ConnectedEvent {
  peerId: string;
}

export interface SpaceStateEvent {
  peers: Record<string, PeerData>;
  // NOTE: Screen shares are managed by CRDT, not sent via Socket.io
}

export interface PeerJoinedEvent {
  peerId: string;
  username: string;
  position: Position;
}

export interface PeerLeftEvent {
  peerId: string;
}

export interface ScreenShareStartedBroadcast {
  peerId: string;
  shareId: string;
  username: string;
}

export interface ScreenShareStoppedBroadcast {
  peerId: string;
  shareId: string;
}

// ==================== Space Info Events ====================

export interface GetSpaceInfoEvent {
  spaceId: string;
}

export interface SpaceInfoEvent {
  spaceId: string;
  exists: boolean;
  participants: string[];
}

// ==================== Activity Events ====================

export type SpaceEventType = 'join_first' | 'join' | 'leave' | 'leave_last';

export interface SpaceActivityItem {
  id: number;
  space_id: string;
  event_type: SpaceEventType;
  username: string;
  created_at: string;
}

export interface SpaceActivityEvent {
  spaceId: string;
  events: SpaceActivityItem[];
}

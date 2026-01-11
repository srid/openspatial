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

export interface PositionUpdateEvent {
  peerId: string;
  x: number;
  y: number;
}

export interface MediaStateUpdateEvent {
  peerId: string;
  isMuted: boolean;
  isVideoOff: boolean;
}

export interface StatusUpdateEvent {
  peerId: string;
  status: string;
}

export interface ScreenShareStartedEvent {
  peerId: string;
  shareId: string;
  // Position is managed by CRDT
}

export interface ScreenShareStoppedEvent {
  peerId: string;
  shareId: string;
}

export interface ScreenSharePositionUpdateEvent {
  shareId: string;
  x: number;
  y: number;
}

export interface ScreenShareResizeUpdateEvent {
  shareId: string;
  width: number;
  height: number;
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
  participants: string[];
}

/*
 * OpenSpatial
 * Copyright (C) 2025 Sridhar Ratnakumar
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */

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
}

export interface ScreenShareData {
  peerId: string;
  username: string;
  x: number;
  y: number;
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

export interface ScreenShareStartedEvent {
  peerId: string;
  shareId: string;
  x: number;
  y: number;
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

// ==================== Socket Events (Server -> Client) ====================

export interface ConnectedEvent {
  peerId: string;
}

export interface SpaceStateEvent {
  peers: Record<string, PeerData>;
  screenShares: Record<string, ScreenShareData>;
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

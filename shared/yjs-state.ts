/**
 * Shared CRDT schema for OpenSpatial canvas state.
 * Used by both client and server to ensure consistent document structure.
 */

import * as Y from 'yjs';

// ==================== CRDT State Types ====================

export interface PeerState {
  username: string;
  x: number;
  y: number;
  isMuted: boolean;
  isVideoOff: boolean;
  isScreenSharing: boolean;
  status?: string;
}

export interface ScreenShareState {
  peerId: string;
  username: string;
  x: number;
  y: number;
  width?: number;
  height?: number;
}

// ==================== Document Structure ====================

/**
 * Create a new Yjs document with the OpenSpatial schema.
 * Structure:
 *   - peers: Y.Map<peerId, PeerState>
 *   - screenShares: Y.Map<shareId, ScreenShareState>
 */
export function createCanvasDoc(): Y.Doc {
  return new Y.Doc();
}

/**
 * Get the peers map from a canvas document.
 */
export function getPeersMap(doc: Y.Doc): Y.Map<PeerState> {
  return doc.getMap<PeerState>('peers');
}

/**
 * Get the screen shares map from a canvas document.
 */
export function getScreenSharesMap(doc: Y.Doc): Y.Map<ScreenShareState> {
  return doc.getMap<ScreenShareState>('screenShares');
}

// ==================== Peer Operations ====================

export function addPeer(doc: Y.Doc, peerId: string, data: PeerState): void {
  getPeersMap(doc).set(peerId, data);
}

export function updatePeerPosition(doc: Y.Doc, peerId: string, x: number, y: number): void {
  const peers = getPeersMap(doc);
  const peer = peers.get(peerId);
  if (peer) {
    peers.set(peerId, { ...peer, x, y });
  }
}

export function updatePeerMediaState(
  doc: Y.Doc,
  peerId: string,
  isMuted: boolean,
  isVideoOff: boolean
): void {
  const peers = getPeersMap(doc);
  const peer = peers.get(peerId);
  if (peer) {
    peers.set(peerId, { ...peer, isMuted, isVideoOff });
  }
}

export function updatePeerStatus(doc: Y.Doc, peerId: string, status: string): void {
  const peers = getPeersMap(doc);
  const peer = peers.get(peerId);
  if (peer) {
    peers.set(peerId, { ...peer, status });
  }
}

export function removePeer(doc: Y.Doc, peerId: string): void {
  getPeersMap(doc).delete(peerId);
}

// ==================== Screen Share Operations ====================

export function addScreenShare(doc: Y.Doc, shareId: string, data: ScreenShareState): void {
  const peers = getPeersMap(doc);
  const peer = peers.get(data.peerId);
  if (peer) {
    peers.set(data.peerId, { ...peer, isScreenSharing: true });
  }
  getScreenSharesMap(doc).set(shareId, data);
}

export function updateScreenSharePosition(doc: Y.Doc, shareId: string, x: number, y: number): void {
  const shares = getScreenSharesMap(doc);
  const share = shares.get(shareId);
  if (share) {
    shares.set(shareId, { ...share, x, y });
  }
}

export function updateScreenShareSize(
  doc: Y.Doc,
  shareId: string,
  width: number,
  height: number
): void {
  const shares = getScreenSharesMap(doc);
  const share = shares.get(shareId);
  if (share) {
    shares.set(shareId, { ...share, width, height });
  }
}

export function removeScreenShare(doc: Y.Doc, shareId: string): void {
  const shares = getScreenSharesMap(doc);
  const share = shares.get(shareId);
  if (share) {
    const peers = getPeersMap(doc);
    const peer = peers.get(share.peerId);
    if (peer) {
      peers.set(share.peerId, { ...peer, isScreenSharing: false });
    }
  }
  shares.delete(shareId);
}

export function removeScreenSharesByPeer(doc: Y.Doc, peerId: string): void {
  const shares = getScreenSharesMap(doc);
  for (const [shareId, share] of shares.entries()) {
    if (share.peerId === peerId) {
      shares.delete(shareId);
    }
  }
}

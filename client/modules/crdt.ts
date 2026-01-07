/**
 * Client-side CRDT manager for OpenSpatial canvas state.
 * Uses y-socket.io's SocketIOProvider for document synchronization.
 */

import * as Y from 'yjs';
import { SocketIOProvider } from 'y-socket.io';
import {
  getPeersMap,
  getScreenSharesMap,
  addPeer,
  updatePeerPosition,
  updatePeerMediaState,
  updatePeerStatus,
  addScreenShare,
  updateScreenSharePosition,
  updateScreenShareSize,
  removeScreenShare,
  type PeerState,
  type ScreenShareState,
} from '../../shared/yjs-state.js';

export type PeersChangeCallback = (peers: Map<string, PeerState>) => void;
export type ScreenSharesChangeCallback = (shares: Map<string, ScreenShareState>) => void;

export class CRDTManager {
  private doc: Y.Doc;
  private provider: SocketIOProvider | null = null;
  private peersObservers: PeersChangeCallback[] = [];
  private screensharesObservers: ScreenSharesChangeCallback[] = [];
  private _peerId: string | null = null;
  private _spaceId: string | null = null;

  constructor() {
    this.doc = new Y.Doc();
    this.setupDocObservers();
  }

  get peerId(): string | null {
    return this._peerId;
  }

  get spaceId(): string | null {
    return this._spaceId;
  }

  private setupDocObservers(): void {
    const peers = getPeersMap(this.doc);
    const screenShares = getScreenSharesMap(this.doc);

    peers.observe(() => {
      const peersMap = new Map<string, PeerState>();
      peers.forEach((value, key) => {
        peersMap.set(key, value);
      });
      this.peersObservers.forEach((cb) => cb(peersMap));
    });

    screenShares.observe(() => {
      const sharesMap = new Map<string, ScreenShareState>();
      screenShares.forEach((value, key) => {
        sharesMap.set(key, value);
      });
      this.screensharesObservers.forEach((cb) => cb(sharesMap));
    });
  }

  /**
   * Connect to a space and join as a peer.
   * Uses the provided peerId from socket signaling for WebRTC compatibility.
   */
  connect(spaceId: string, peerId: string, username: string): Promise<{ position: { x: number; y: number } }> {
    this._spaceId = spaceId;
    this._peerId = peerId;

    return new Promise((resolve, reject) => {
      const serverUrl = window.location.origin;

      const timeout = setTimeout(() => {
        console.error('[CRDT] Connection timeout');
        reject(new Error('CRDT connection timeout'));
      }, 10000);

      try {
        this.provider = new SocketIOProvider(serverUrl, spaceId, this.doc, {
          autoConnect: true,
          resyncInterval: 5000,
          disableBc: false,
        });

        this.provider.on('status', ({ status }: { status: string }) => {
          console.log(`[CRDT] Connection status: ${status}`);

          if (status === 'connected') {
            clearTimeout(timeout);

            // Generate initial position
            const position = {
              x: 1800 + Math.random() * 400,
              y: 1800 + Math.random() * 400,
            };

            // Add ourselves to the CRDT document
            const peerState: PeerState = {
              username,
              x: position.x,
              y: position.y,
              isMuted: false,
              isVideoOff: false,
              isScreenSharing: false,
            };
            addPeer(this.doc, this._peerId!, peerState);

            resolve({ position });
          }
        });

        this.provider.on('sync', (synced: boolean) => {
          console.log(`[CRDT] Synced: ${synced}`);
        });

        this.provider.on('connection-error' as string, (error: Error) => {
          clearTimeout(timeout);
          console.error('[CRDT] Connection error:', error);
          reject(error);
        });
      } catch (err) {
        clearTimeout(timeout);
        reject(err);
      }
    });
  }

  /**
   * Disconnect from the space and clean up.
   */
  disconnect(): void {
    if (this._peerId) {
      // Remove ourselves from the document
      getPeersMap(this.doc).delete(this._peerId);
    }

    if (this.provider) {
      this.provider.destroy();
      this.provider = null;
    }

    this._peerId = null;
    this._spaceId = null;
  }

  // ==================== Observers ====================

  observePeers(callback: PeersChangeCallback): () => void {
    this.peersObservers.push(callback);
    // Immediately call with current state
    callback(this.getPeers());
    // Return unsubscribe function
    return () => {
      const idx = this.peersObservers.indexOf(callback);
      if (idx > -1) this.peersObservers.splice(idx, 1);
    };
  }

  observeScreenShares(callback: ScreenSharesChangeCallback): () => void {
    this.screensharesObservers.push(callback);
    callback(this.getScreenShares());
    return () => {
      const idx = this.screensharesObservers.indexOf(callback);
      if (idx > -1) this.screensharesObservers.splice(idx, 1);
    };
  }

  // ==================== Mutations ====================

  updatePosition(peerId: string, x: number, y: number): void {
    updatePeerPosition(this.doc, peerId, x, y);
  }

  updateMediaState(peerId: string, isMuted: boolean, isVideoOff: boolean): void {
    updatePeerMediaState(this.doc, peerId, isMuted, isVideoOff);
  }

  updateStatus(peerId: string, status: string): void {
    updatePeerStatus(this.doc, peerId, status);
  }

  addScreenShare(shareId: string, data: ScreenShareState): void {
    addScreenShare(this.doc, shareId, data);
  }

  updateScreenSharePosition(shareId: string, x: number, y: number): void {
    updateScreenSharePosition(this.doc, shareId, x, y);
  }

  updateScreenShareSize(shareId: string, width: number, height: number): void {
    updateScreenShareSize(this.doc, shareId, width, height);
  }

  removeScreenShare(shareId: string): void {
    removeScreenShare(this.doc, shareId);
  }

  // ==================== Read State ====================

  getPeers(): Map<string, PeerState> {
    const peers = getPeersMap(this.doc);
    const result = new Map<string, PeerState>();
    peers.forEach((value, key) => {
      result.set(key, value);
    });
    return result;
  }

  getScreenShares(): Map<string, ScreenShareState> {
    const shares = getScreenSharesMap(this.doc);
    const result = new Map<string, ScreenShareState>();
    shares.forEach((value, key) => {
      result.set(key, value);
    });
    return result;
  }

  getPeer(peerId: string): PeerState | undefined {
    return getPeersMap(this.doc).get(peerId);
  }

  getScreenShare(shareId: string): ScreenShareState | undefined {
    return getScreenSharesMap(this.doc).get(shareId);
  }
}

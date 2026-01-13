/**
 * CRDTManager - Manages Yjs document synchronization via y-websocket.
 * Replaces Socket.io state sync for positions, media state, status, and screen shares.
 */
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';
import type { PeerState, ScreenShareState, TextNoteState } from '../../shared/yjs-schema.js';

type PeersCallback = (peers: Map<string, PeerState>) => void;
type ScreenSharesCallback = (shares: Map<string, ScreenShareState>) => void;
type TextNotesCallback = (notes: Map<string, TextNoteState>) => void;

export class CRDTManager {
  private doc: Y.Doc;
  private provider: WebsocketProvider;
  private peers: Y.Map<PeerState>;
  private screenShares: Y.Map<ScreenShareState>;
  private textNotes: Y.Map<TextNoteState>;
  private peersCallbacks: PeersCallback[] = [];
  private screenSharesCallbacks: ScreenSharesCallback[] = [];
  private textNotesCallbacks: TextNotesCallback[] = [];

  constructor(spaceId: string) {
    this.doc = new Y.Doc();
    
    // Connect to y-websocket server
    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${wsProtocol}//${window.location.host}/yjs`;
    this.provider = new WebsocketProvider(wsUrl, spaceId, this.doc);
    
    this.peers = this.doc.getMap('peers');
    this.screenShares = this.doc.getMap('screenShares');
    this.textNotes = this.doc.getMap('textNotes');
    
    // Set up observers
    this.peers.observe(() => this.notifyPeersChange());
    this.screenShares.observe(() => this.notifyScreenSharesChange());
    this.textNotes.observe(() => this.notifyTextNotesChange());
    
    this.provider.on('status', ({ status }: { status: string }) => {
      console.log(`[CRDT] Connection status: ${status}`);
    });
    
    this.provider.on('synced', ({ synced }: { synced: boolean }) => {
      console.log(`[CRDT] Synced: ${synced}, peers: ${this.peers.size}`);
    });
  }

  /**
   * Wait for the CRDT document to sync with the server.
   * This is important for late-joiners who need to receive existing state.
   */
  async waitForSync(timeoutMs: number = 5000): Promise<void> {
    if (this.provider.synced) {
      console.log('[CRDT] Already synced');
      return;
    }
    
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        resolve(); // Resolve anyway to not block the app
      }, timeoutMs);
      
      this.provider.on('synced', () => {
        clearTimeout(timeout);
        resolve();
      });
    });
  }

  // === Peer State Updates ===
  
  addPeer(peerId: string, username: string, x: number, y: number): void {
    this.peers.set(peerId, {
      username,
      x,
      y,
      isMuted: false,
      isVideoOff: false,
      status: ''
    });
  }

  removePeer(peerId: string): void {
    this.peers.delete(peerId);
  }

  updatePosition(peerId: string, x: number, y: number): void {
    const peer = this.peers.get(peerId);
    if (peer) {
      this.peers.set(peerId, { ...peer, x, y });
    }
  }

  updateMediaState(peerId: string, isMuted: boolean, isVideoOff: boolean): void {
    const peer = this.peers.get(peerId);
    if (peer) {
      this.peers.set(peerId, { ...peer, isMuted, isVideoOff });
    }
  }

  updateStatus(peerId: string, status: string): void {
    const peer = this.peers.get(peerId);
    if (peer) {
      this.peers.set(peerId, { ...peer, status });
    }
  }

  // === Screen Share State Updates ===

  addScreenShare(shareId: string, peerId: string, username: string, x: number, y: number, width: number, height: number): void {
    this.screenShares.set(shareId, {
      peerId,
      username,
      x,
      y,
      width,
      height
    });
  }

  removeScreenShare(shareId: string): void {
    this.screenShares.delete(shareId);
  }

  updateScreenSharePosition(shareId: string, x: number, y: number): void {
    const share = this.screenShares.get(shareId);
    if (share) {
      this.screenShares.set(shareId, { ...share, x, y });
    }
  }

  updateScreenShareSize(shareId: string, width: number, height: number): void {
    const share = this.screenShares.get(shareId);
    if (share) {
      this.screenShares.set(shareId, { ...share, width, height });
    }
  }

  // === Observers ===

  observePeers(callback: PeersCallback): void {
    this.peersCallbacks.push(callback);
    // Wait for sync before initial call to ensure late-joiners get full state
    this.waitForSync(2000).then(() => {
      callback(this.getPeersAsMap());
    });
  }

  observeScreenShares(callback: ScreenSharesCallback): void {
    this.screenSharesCallbacks.push(callback);
    // Wait for sync before initial call to ensure late-joiners get full state
    this.waitForSync(2000).then(() => {
      callback(this.getScreenSharesAsMap());
    });
  }

  private notifyPeersChange(): void {
    const peersMap = this.getPeersAsMap();
    for (const callback of this.peersCallbacks) {
      callback(peersMap);
    }
  }

  private notifyScreenSharesChange(): void {
    const sharesMap = this.getScreenSharesAsMap();
    for (const callback of this.screenSharesCallbacks) {
      callback(sharesMap);
    }
  }

  private getPeersAsMap(): Map<string, PeerState> {
    const result = new Map<string, PeerState>();
    for (const [key, value] of this.peers.entries()) {
      result.set(key, value);
    }
    return result;
  }

  private getScreenSharesAsMap(): Map<string, ScreenShareState> {
    const result = new Map<string, ScreenShareState>();
    for (const [key, value] of this.screenShares.entries()) {
      result.set(key, value);
    }
    return result;
  }

  // === Getters ===

  getPeer(peerId: string): PeerState | undefined {
    return this.peers.get(peerId);
  }

  getScreenShare(shareId: string): ScreenShareState | undefined {
    return this.screenShares.get(shareId);
  }

  getTextNote(noteId: string): TextNoteState | undefined {
    return this.textNotes.get(noteId);
  }

  // === Text Note State Updates ===

  addTextNote(
    noteId: string,
    peerId: string,
    username: string,
    content: string,
    x: number,
    y: number,
    width: number,
    height: number,
    fontSize: 'small' | 'medium' | 'large' = 'medium',
    fontFamily: 'sans' | 'serif' | 'mono' = 'sans',
    color: string = '#ffffff'
  ): void {
    this.textNotes.set(noteId, {
      peerId,
      username,
      content,
      x,
      y,
      width,
      height,
      fontSize,
      fontFamily,
      color
    });
  }

  removeTextNote(noteId: string): void {
    this.textNotes.delete(noteId);
  }

  updateTextNotePosition(noteId: string, x: number, y: number): void {
    const note = this.textNotes.get(noteId);
    if (note) {
      this.textNotes.set(noteId, { ...note, x, y });
    }
  }

  updateTextNoteSize(noteId: string, width: number, height: number): void {
    const note = this.textNotes.get(noteId);
    if (note) {
      this.textNotes.set(noteId, { ...note, width, height });
    }
  }

  updateTextNoteContent(noteId: string, content: string): void {
    const note = this.textNotes.get(noteId);
    if (note) {
      this.textNotes.set(noteId, { ...note, content });
    }
  }

  updateTextNoteStyle(noteId: string, fontSize: 'small' | 'medium' | 'large', color: string): void {
    const note = this.textNotes.get(noteId);
    if (note) {
      this.textNotes.set(noteId, { ...note, fontSize, color });
    }
  }

  observeTextNotes(callback: TextNotesCallback): void {
    this.textNotesCallbacks.push(callback);
    this.waitForSync(2000).then(() => {
      callback(this.getTextNotesAsMap());
    });
  }

  private notifyTextNotesChange(): void {
    const notesMap = this.getTextNotesAsMap();
    for (const callback of this.textNotesCallbacks) {
      callback(notesMap);
    }
  }

  private getTextNotesAsMap(): Map<string, TextNoteState> {
    const result = new Map<string, TextNoteState>();
    for (const [key, value] of this.textNotes.entries()) {
      result.set(key, value);
    }
    return result;
  }

  // === Cleanup ===

  destroy(): void {
    this.provider.disconnect();
    this.provider.destroy();
    this.doc.destroy();
    this.peersCallbacks = [];
    this.screenSharesCallbacks = [];
    this.textNotesCallbacks = [];
  }
}

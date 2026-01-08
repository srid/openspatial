/**
 * Yjs synchronization using y-socket.io.
 * This integrates with our existing Socket.io server to provide CRDT-based document sync.
 */

import type { Server } from 'socket.io';
import { YSocketIO } from 'y-socket.io/dist/server';
import {
  getPeersMap,
  getScreenSharesMap,
} from '../shared/yjs-state.js';

// Export the YSocketIO instance for access to documents
let ysocketio: YSocketIO | null = null;

/**
 * Initialize Yjs document synchronization on the Socket.io server.
 *
 * y-socket.io automatically:
 * - Creates documents per room (namespace pattern: /yjs|{roomName})
 * - Syncs document state between all connected clients
 * - Handles awareness (cursor positions, presence)
 * - Manages document lifecycle (create, update, destroy)
 */
export function initializeYjsSync(io: Server): YSocketIO {
  ysocketio = new YSocketIO(io, {
    // For now, accept all connections (auth can be added later)
    authenticate: undefined,
    // No persistence yet (planned for future)
    levelPersistenceDir: undefined,
    // Enable garbage collection
    gcEnabled: true,
  });

  // Initialize the sync handlers
  ysocketio.initialize();

  // Document lifecycle events for logging/debugging
  ysocketio.on('document-loaded', (doc: unknown) => {
    // @ts-expect-error doc has name property
    console.log(`[Yjs] Document loaded: ${doc.name}`);
  });



  ysocketio.on('all-document-connections-closed', (doc: unknown) => {
    // @ts-expect-error doc has name property
    const docName = doc.name;
    console.log(`[Yjs] All connections closed for: ${docName}, clearing document data`);
    
    // Clear all peers and screen shares when room is empty
    // This prevents stale data from persisting between sessions
    // @ts-expect-error doc is Y.Doc
    const peers = getPeersMap(doc);
    // @ts-expect-error doc is Y.Doc
    const screenShares = getScreenSharesMap(doc);
    
    peers.forEach((_, key) => peers.delete(key));
    screenShares.forEach((_, key) => screenShares.delete(key));
  });

  ysocketio.on('document-destroy', (doc: unknown) => {
    // @ts-expect-error doc has name property
    console.log(`[Yjs] Document destroyed: ${doc.name}`);
  });

  console.log('[Yjs] Sync initialized');
  return ysocketio;
}

/**
 * Get participant usernames for a space (for pre-join info).
 * Reads from the CRDT document if it exists.
 */
export function getSpaceParticipants(spaceId: string): string[] {
  if (!ysocketio) return [];

  const doc = ysocketio.documents.get(spaceId);
  if (!doc) return [];

  const peers = getPeersMap(doc);
  const participants: string[] = [];
  peers.forEach((peer) => {
    participants.push(peer.username);
  });
  return participants;
}

/**
 * Get the YSocketIO instance (for advanced usage).
 */
export function getYSocketIO(): YSocketIO | null {
  return ysocketio;
}

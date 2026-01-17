/**
 * y-websocket server for Yjs document synchronization.
 * Runs alongside Socket.io signaling on the same HTTP server.
 * Uses noServer mode to avoid conflicts with Socket.io's WebSocket handling.
 * 
 * Persistence: Text notes are hydrated from SQLite on first connection
 * and persisted back via debounced observer.
 */
import type { Server as HttpServer } from 'http';
import type { Server as HttpsServer } from 'https';
import { WebSocketServer, WebSocket } from 'ws';
import type { IncomingMessage } from 'http';
import type { Duplex } from 'stream';
import * as Y from 'yjs';
// @ts-expect-error - y-websocket utils has no types
import { setupWSConnection, docs } from 'y-websocket/bin/utils';
import { getTextNotes, upsertTextNote, deleteTextNote, rowToTextNoteState, getSpace } from './db.js';
import type { TextNoteState } from '../shared/yjs-schema.js';

// Track which spaces have been hydrated to avoid duplicate hydration
const hydratedSpaces = new Set<string>();

// Track pending writes per space (debounced)
const pendingWrites = new Map<string, Map<string, { action: 'upsert' | 'delete'; value?: TextNoteState }>>();
const writeTimeouts = new Map<string, NodeJS.Timeout>();

const DEBOUNCE_MS = 2000;

/**
 * Hydrate a Y.Doc with text notes from SQLite
 */
function hydrateFromSQLite(doc: Y.Doc, spaceId: string): void {
  if (hydratedSpaces.has(spaceId)) return;
  
  // Only hydrate if this is a valid space
  const space = getSpace(spaceId);
  if (!space) {
    console.log(`[Yjs] Space ${spaceId} not found in DB, skipping hydration`);
    return;
  }
  
  const rows = getTextNotes(spaceId);
  if (rows.length === 0) {
    console.log(`[Yjs] No text notes to hydrate for space ${spaceId}`);
    hydratedSpaces.add(spaceId);
    return;
  }
  
  const textNotes = doc.getMap<TextNoteState>('textNotes');
  
  // Apply all inserts in a single transaction
  doc.transact(() => {
    for (const row of rows) {
      textNotes.set(row.id, rowToTextNoteState(row));
    }
  });
  
  hydratedSpaces.add(spaceId);
  console.log(`[Yjs] Hydrated ${rows.length} text notes for space ${spaceId}`);
}

/**
 * Set up observer to persist changes back to SQLite (debounced)
 */
function observeAndPersist(doc: Y.Doc, spaceId: string): void {
  // Only persist to valid spaces
  const space = getSpace(spaceId);
  if (!space) return;
  
  const textNotes = doc.getMap<TextNoteState>('textNotes');
  
  textNotes.observe((event) => {
    // Get or create pending writes for this space
    if (!pendingWrites.has(spaceId)) {
      pendingWrites.set(spaceId, new Map());
    }
    const pending = pendingWrites.get(spaceId)!;
    
    event.changes.keys.forEach((change, key) => {
      if (change.action === 'delete') {
        pending.set(key, { action: 'delete' });
      } else {
        const value = textNotes.get(key);
        if (value) {
          pending.set(key, { action: 'upsert', value });
        }
      }
    });
    
    // Debounce writes
    const existingTimeout = writeTimeouts.get(spaceId);
    if (existingTimeout) clearTimeout(existingTimeout);
    
    writeTimeouts.set(spaceId, setTimeout(() => {
      flushToSQLite(spaceId);
    }, DEBOUNCE_MS));
  });
}

/**
 * Flush pending writes to SQLite
 */
function flushToSQLite(spaceId: string): void {
  const pending = pendingWrites.get(spaceId);
  if (!pending || pending.size === 0) return;
  
  let upserts = 0;
  let deletes = 0;
  
  for (const [noteId, change] of pending) {
    if (change.action === 'delete') {
      deleteTextNote(noteId);
      deletes++;
    } else if (change.value) {
      upsertTextNote(spaceId, noteId, change.value);
      upserts++;
    }
  }
  
  pending.clear();
  writeTimeouts.delete(spaceId);
  
  if (upserts > 0 || deletes > 0) {
    console.log(`[Yjs] Persisted to SQLite for ${spaceId}: ${upserts} upserts, ${deletes} deletes`);
  }
}

export function attachYjsServer(server: HttpServer | HttpsServer): void {
  // Use noServer mode to manually handle upgrade requests
  // This allows Socket.io to continue handling /socket.io paths
  const wss = new WebSocketServer({ noServer: true });

  // Handle upgrade requests manually, only for /yjs path
  server.on('upgrade', (request: IncomingMessage, socket: Duplex, head: Buffer) => {
    const url = request.url || '';
    const pathname = new URL(url, `http://${request.headers.host}`).pathname;
    
    // Only handle /yjs paths, let Socket.io handle the rest
    if (pathname === '/yjs' || pathname.startsWith('/yjs/')) {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request);
      });
    }
    // Socket.io handles /socket.io paths automatically
  });

  wss.on('connection', (ws: WebSocket, req: IncomingMessage) => {
    // Extract spaceId from URL: /yjs/spaceId
    const url = req.url || '';
    const pathname = new URL(url, `http://${req.headers.host}`).pathname;
    const spaceId = pathname.replace(/^\/yjs\/?/, '') || 'default';
    
    console.log(`[Yjs] Client connected to space: ${spaceId}`);
    
    // Set up connection first (creates doc if needed)
    setupWSConnection(ws, req, { docName: spaceId });
    
    // Get the doc (should exist now)
    const doc = docs.get(spaceId) as Y.Doc | undefined;
    if (doc) {
      // Hydrate from SQLite on first connection
      hydrateFromSQLite(doc, spaceId);
      
      // Set up persistence observer (only once per doc)
      if (!pendingWrites.has(spaceId)) {
        observeAndPersist(doc, spaceId);
      }
    }
  });

  console.log('[Yjs] WebSocket server attached at /yjs (with SQLite persistence)');
}


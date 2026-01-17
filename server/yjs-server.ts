/**
 * Yjs WebSocket server with SQLite persistence.
 * Handles CRDT synchronization and persists text notes to the database.
 */
import type { IncomingMessage } from 'http';
import type { Duplex } from 'stream';
import type { Server as HttpServer } from 'http';
import type { Server as HttpsServer } from 'https';
import { WebSocket, WebSocketServer } from 'ws';
import * as Y from 'yjs';
// @ts-expect-error - y-websocket utils has no types
import { setupWSConnection, docs } from 'y-websocket/bin/utils';
import { getTextNotes, upsertTextNote, deleteTextNote, getSpace, createSpace } from './db.js';
import type { TextNoteState } from '../shared/yjs-schema.js';

// Environment config
const AUTO_CREATE_SPACES = process.env.AUTO_CREATE_SPACES === 'true';

// Track which spaces have been hydrated to avoid duplicate hydration
const hydratedSpaces = new Set<string>();

// Track pending writes per space (debounced)
const pendingWrites = new Map<string, Map<string, { action: 'upsert' | 'delete'; value?: TextNoteState }>>();
const writeTimeouts = new Map<string, NodeJS.Timeout>();

const DEBOUNCE_MS = 2000;

/**
 * Hydrate a Y.Doc with text notes from SQLite
 */
async function hydrateFromSQLite(doc: Y.Doc, spaceId: string): Promise<void> {
  if (hydratedSpaces.has(spaceId)) return;
  
  // Only hydrate if this is a valid space
  const space = await getSpace(spaceId);
  if (!space) {
    console.log(`[Yjs] Space ${spaceId} not found in DB, skipping hydration`);
    return;
  }
  
  const rows = await getTextNotes(spaceId);
  if (rows.length === 0) {
    console.log(`[Yjs] No text notes to hydrate for space ${spaceId}`);
    hydratedSpaces.add(spaceId);
    return;
  }
  
  const textNotes = doc.getMap<TextNoteState>('textNotes');
  
  // Apply all inserts in a single transaction
  doc.transact(() => {
    for (const note of rows) {
      const { id, ...state } = note;
      textNotes.set(id, state);
    }
  });
  
  hydratedSpaces.add(spaceId);
  console.log(`[Yjs] Hydrated ${rows.length} text notes for space ${spaceId}`);
}

/**
 * Set up observer to persist changes back to SQLite (debounced)
 */
async function observeAndPersist(doc: Y.Doc, spaceId: string): Promise<void> {
  // Only persist to valid spaces
  const space = await getSpace(spaceId);
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
async function flushToSQLite(spaceId: string): Promise<void> {
  const pending = pendingWrites.get(spaceId);
  if (!pending || pending.size === 0) return;
  
  let upserts = 0;
  let deletes = 0;
  
  for (const [noteId, change] of pending) {
    if (change.action === 'delete') {
      await deleteTextNote(noteId);
      deletes++;
    } else if (change.value) {
      await upsertTextNote(spaceId, noteId, change.value);
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

  wss.on('connection', async (ws: WebSocket, req: IncomingMessage) => {
    // Extract spaceId from URL: /yjs/spaceId
    const url = req.url || '';
    const pathname = new URL(url, `http://${req.headers.host}`).pathname;
    const spaceId = pathname.replace(/^\/yjs\/?/, '') || 'default';
    
    // Validate space exists before allowing connection
    let space = await getSpace(spaceId);
    if (!space) {
      if (AUTO_CREATE_SPACES) {
        // Auto-create space (for dev/testing)
        try {
          await createSpace(spaceId);
          console.log(`[Yjs] Auto-created space: ${spaceId}`);
          space = await getSpace(spaceId);
        } catch (e) {
          // Space might have been created by another connection
          space = await getSpace(spaceId);
        }
      }
      
      if (!space) {
        console.log(`[Yjs] Rejecting connection to unknown space: ${spaceId}`);
        ws.close(4001, `Space "${spaceId}" not found`);
        return;
      }
    }
    
    console.log(`[Yjs] Client connected to space: ${spaceId}`);
    
    // Set up connection first (creates doc if needed)
    setupWSConnection(ws, req, { docName: spaceId });
    
    // Get the doc (should exist now)
    const doc = docs.get(spaceId) as Y.Doc | undefined;
    if (doc) {
      // Hydrate from SQLite on first connection
      await hydrateFromSQLite(doc, spaceId);
      
      // Set up persistence observer (only once per doc)
      if (!pendingWrites.has(spaceId)) {
        await observeAndPersist(doc, spaceId);
      }
    }
  });

  console.log('[Yjs] WebSocket server attached at /yjs (with SQLite persistence)');
}

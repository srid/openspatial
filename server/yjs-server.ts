/**
 * y-websocket server for Yjs document synchronization.
 * Runs alongside Socket.io signaling on the same HTTP server.
 */
import type { Server as HttpsServer } from 'https';
import { WebSocketServer, WebSocket } from 'ws';
import type { IncomingMessage } from 'http';
// @ts-expect-error - y-websocket utils has no types
import { setupWSConnection } from 'y-websocket/bin/utils';

export function attachYjsServer(server: HttpsServer): void {
  const wss = new WebSocketServer({ server, path: '/yjs' });

  wss.on('connection', (ws: WebSocket, req: IncomingMessage) => {
    // Extract spaceId from URL: /yjs/spaceId
    const url = req.url || '';
    const docName = url.startsWith('/') ? url.slice(1) : url;
    
    console.log(`[Yjs] Client connected to doc: ${docName}`);
    setupWSConnection(ws, req, { docName });
  });

  console.log('[Yjs] WebSocket server attached at /yjs');
}

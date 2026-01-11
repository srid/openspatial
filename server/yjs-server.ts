/**
 * y-websocket server for Yjs document synchronization.
 * Runs alongside Socket.io signaling on the same HTTP server.
 * Uses noServer mode to avoid conflicts with Socket.io's WebSocket handling.
 */
import type { Server as HttpServer } from 'http';
import type { Server as HttpsServer } from 'https';
import { WebSocketServer, WebSocket } from 'ws';
import type { IncomingMessage } from 'http';
import type { Duplex } from 'stream';
// @ts-expect-error - y-websocket utils has no types
import { setupWSConnection } from 'y-websocket/bin/utils';

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
    const docName = pathname.replace(/^\/yjs\/?/, '') || 'default';
    
    console.log(`[Yjs] Client connected to doc: ${docName}`);
    setupWSConnection(ws, req, { docName });
  });

  console.log('[Yjs] WebSocket server attached at /yjs');
}

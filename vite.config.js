import { defineConfig } from 'vite';
import basicSsl from '@vitejs/plugin-basic-ssl';
import { Server } from 'socket.io';
import { WebSocketServer } from 'ws';
import os from 'os';
import { attachSignaling } from './server/signaling.ts';

const hostname = os.hostname();

// Socket.io signaling server plugin for Vite
function socketPlugin() {
  return {
    name: 'socket-signaling',
    configureServer(server) {
      const io = new Server(server.httpServer, {
        cors: {
          origin: '*',
          methods: ['GET', 'POST']
        }
      });

      attachSignaling(io);
    }
  };
}

// y-websocket server plugin for Yjs document sync
// Uses noServer mode to avoid conflicting with Socket.io
function yjsPlugin() {
  return {
    name: 'yjs-websocket',
    configureServer(server) {
      // Dynamic import to avoid issues with ESM
      import('y-websocket/bin/utils').then(({ setupWSConnection }) => {
        const wss = new WebSocketServer({ noServer: true });
        
        // Handle upgrade requests manually, only for /yjs path
        server.httpServer.on('upgrade', (request, socket, head) => {
          const pathname = new URL(request.url || '', `http://${request.headers.host}`).pathname;
          
          // Only handle /yjs paths, let Socket.io handle the rest
          if (pathname === '/yjs' || pathname.startsWith('/yjs/')) {
            wss.handleUpgrade(request, socket, head, (ws) => {
              wss.emit('connection', ws, request);
            });
          }
          // Socket.io handles /socket.io paths automatically
        });
        
        wss.on('connection', (ws, req) => {
          // Extract spaceId from URL: /yjs/spaceId
          const url = req.url || '';
          const pathname = new URL(url, `http://${req.headers.host}`).pathname;
          const docName = pathname.replace(/^\/yjs\/?/, '') || 'default';
          console.log(`[Yjs Dev] Client connected to doc: ${docName}`);
          setupWSConnection(ws, req, { docName });
        });
        console.log('[Yjs Dev] WebSocket server attached at /yjs');
      });
    }
  };
}

// SPA fallback plugin for /s/* routes
function spaFallbackPlugin() {
  return {
    name: 'spa-fallback',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        // Serve index.html for /s/* routes (SPA fallback)
        if (req.url?.startsWith('/s/')) {
          req.url = '/';
        }
        next();
      });
    }
  };
}

export default defineConfig({
  plugins: [
    basicSsl({ domains: ['localhost', hostname] }),
    spaFallbackPlugin(),
    socketPlugin(),
    yjsPlugin()
  ],
  server: {
    host: '0.0.0.0',
    https: true,
    hmr: {
      host: hostname
    }
  }
});

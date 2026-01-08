import { defineConfig } from 'vite';
import basicSsl from '@vitejs/plugin-basic-ssl';
import { Server } from 'socket.io';
import os from 'os';
import { attachSignaling } from './server/signaling.ts';
import { initializeYjsSync } from './server/yjs-provider.ts';

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

      // Initialize Yjs CRDT sync (uses /yjs|* namespace)
      initializeYjsSync(io);

      // Keep existing signaling for WebRTC (will be deprecated in cleanup phase)
      attachSignaling(io);
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
    socketPlugin()
  ],
  server: {
    host: '0.0.0.0',
    https: true,
    hmr: {
      host: hostname
    }
  }
});

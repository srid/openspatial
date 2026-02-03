import { defineConfig } from 'vite';
import solidPlugin from 'vite-plugin-solid';
import basicSsl from '@vitejs/plugin-basic-ssl';
import { Server } from 'socket.io';
import os from 'os';
import path from 'path';
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
        },
        // Aggressive ping settings for mobile disconnect detection
        pingTimeout: 10000,
        pingInterval: 5000,
      });

      attachSignaling(io);
    }
  };
}

// y-websocket server plugin for Yjs document sync
// Uses the same implementation as production (yjs-server.ts) for consistency
// DEV MODE: Sets AUTO_CREATE_SPACES=true for E2E testing
function yjsPlugin() {
  // Enable auto-creation of spaces in dev mode
  process.env.AUTO_CREATE_SPACES = 'true';
  
  return {
    name: 'yjs-websocket',
    configureServer(server) {
      // Use the same yjs-server implementation as production
      import('./server/yjs-server.ts').then(async ({ attachYjsServer }) => {
        // Run migrations and ensure demo space before attaching
        const { runMigrations, ensureDemoSpace } = await import('./server/db.ts');
        await runMigrations();
        await ensureDemoSpace();
        
        // Attach the shared Yjs server (same as production)
        attachYjsServer(server.httpServer);
        console.log('[Yjs Dev] Using shared yjs-server.ts implementation');
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
    solidPlugin(),
    basicSsl({ domains: ['localhost', hostname] }),
    spaFallbackPlugin(),
    socketPlugin(),
    yjsPlugin()
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './client')
    }
  },
  server: {
    host: '0.0.0.0',
    https: true,
    hmr: {
      host: hostname
    }
  }
});

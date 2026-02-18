/**
 * OpenSpatial Server — Unified entry point.
 * Runs in both dev (with Vite HMR middleware) and prod (with static files).
 *
 * Dev:  tsx server/main.ts --dev   → Vite middleware for HMR + module transforms
 * Prod: tsx server/main.ts         → serves dist/ static files via Hono
 */
import { createServer as createHttpServer, type Server as HttpServer, type IncomingMessage, type ServerResponse } from 'http';
import { createServer as createHttpsServer, type Server as HttpsServer } from 'https';
import { Server } from 'socket.io';
import { getRequestListener } from '@hono/node-server';
import { createApp } from './app.js';
import { attachSignaling } from './signaling.js';
import { attachYjsServer } from './yjs-server.js';
import { initDb, runMigrations, ensureDemoSpace } from './db.js';
import { initNotifier } from './notifier/index.js';

// Detect mode: dev if --dev flag or DEV env var
const isDev = process.argv.includes('--dev') || process.env.DEV === '1';

// Use devConfig in dev, configFromEnv in prod
const { configFromEnv, devConfig } = await import('./config.js');
const config = isDev ? devConfig() : configFromEnv();

// Create the Hono app (skips static file serving in dev — Vite handles it)
const app = createApp(config, { isDev });

// Convert Hono app to Node.js request listener
const honoListener = getRequestListener(app.fetch);

// Create HTTP(S) server
let server: HttpServer | HttpsServer;

if (config.https) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const selfsigned = await import('selfsigned') as any;
  const attrs = [{ name: 'commonName', value: 'localhost' }];
  const pems = selfsigned.generate(attrs, {
    days: 365,
    keySize: 2048,
    algorithm: 'sha256',
    extensions: [
      { name: 'basicConstraints', cA: true },
      { name: 'keyUsage', keyCertSign: true, digitalSignature: true, keyEncipherment: true },
      { name: 'subjectAltName', altNames: [
        { type: 2, value: 'localhost' },
        { type: 7, ip: '127.0.0.1' }
      ]}
    ]
  });

  server = createHttpsServer({ key: pems.private, cert: pems.cert });
  console.log('🔒 HTTPS enabled (self-signed certificate)');
} else {
  server = createHttpServer();
}

// Attach Socket.io signaling
const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
  pingTimeout: 10000,
  pingInterval: 5000,
});
attachSignaling(io, config);

// Attach Yjs WebSocket server for CRDT sync
attachYjsServer(server, config);

// Start
const protocol = config.https ? 'https' : 'http';

(async () => {
  try {
    initDb(config);
    await runMigrations();
    await ensureDemoSpace(config);
    await initNotifier(config);

    if (isDev) {
      // Dev mode: Vite handles client assets & HMR, Hono handles API routes
      const os = await import('os');
      const hostname = os.hostname();

      const { createServer: createViteServer } = await import('vite');
      const vite = await createViteServer({
        server: {
          middlewareMode: true,
          hmr: { server: server as HttpServer },
        },
        appType: 'spa',
      });

      // API routes go to Hono first; everything else goes through Vite (HMR, module transforms, SPA fallback)
      server.on('request', (req: IncomingMessage, res: ServerResponse) => {
        if (req.url?.startsWith('/api/')) {
          honoListener(req, res);
        } else {
          vite.middlewares(req, res, () => {
            honoListener(req, res);
          });
        }
      });

      console.log(`🔥 Vite HMR enabled (dev mode)`);
      console.log(`   Network: ${protocol}://${hostname}:${config.port}`);
    } else {
      // Production: Hono handles everything (API + static files + SPA fallback)
      server.on('request', honoListener);
    }

    server.listen(config.port, '0.0.0.0', () => {
      console.log(`🚀 OpenSpatial running on ${protocol}://0.0.0.0:${config.port}`);
    });
  } catch (err) {
    console.error('Startup failed:', err);
    process.exit(1);
  }
})();

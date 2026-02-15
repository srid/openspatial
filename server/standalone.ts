import express, { Request, Response } from 'express';
import { createServer as createHttpServer, Server as HttpServer } from 'http';
import { createServer as createHttpsServer, Server as HttpsServer } from 'https';
import { Server } from 'socket.io';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { configFromEnv } from './config.js';
import { attachSignaling } from './signaling.js';
import { attachYjsServer } from './yjs-server.js';
import { getIceServers } from './turn-config.js';
import { validateSpace } from './spaces.js';
import { initDb, runMigrations, ensureDemoSpace } from './db.js';
import { initNotifier } from './notifier/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const config = configFromEnv();

const app = express();

// Serve static files from Vite build
// Assets with hashes get long cache, HTML gets no-cache
app.use('/assets', express.static(join(__dirname, '../dist/assets'), {
    maxAge: '1y',
    immutable: true,
}));
app.use(express.static(join(__dirname, '../dist'), {
    // Don't cache HTML so browser always gets fresh asset references
    setHeaders: (res, path) => {
        if (path.endsWith('.html')) {
            res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        }
    }
}));

// API endpoint for ICE servers (STUN + optional TURN)
app.get('/api/ice-servers', (_req: Request, res: Response) => {
    res.json(getIceServers(config.turn));
});

// SPA fallback for /s/:spaceId routes with space validation
app.get('/s/:spaceId', validateSpace, (_req: Request, res: Response) => {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.sendFile(join(__dirname, '../dist/index.html'));
});

let server: HttpServer | HttpsServer;

if (config.https) {
    // Generate self-signed certificate for local HTTPS testing
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

    server = createHttpsServer({
        key: pems.private,
        cert: pems.cert
    }, app);
    
    console.log(`🔒 HTTPS enabled (self-signed certificate)`);
} else {
    server = createHttpServer(app);
}

const io = new Server(server, {
    cors: {
        origin: '*',
        methods: ['GET', 'POST']
    },
    // Aggressive ping settings for mobile disconnect detection
    // Mobile browsers don't reliably fire disconnect events on tab close
    pingTimeout: 10000,    // Wait 10s for pong response (default: 20000)
    pingInterval: 5000,    // Ping every 5s (default: 25000)
});

attachSignaling(io, config);

// Attach Yjs WebSocket server for CRDT document synchronization
attachYjsServer(server, config);

// Async startup: run migrations and ensure demo space before listening
const protocol = config.https ? 'https' : 'http';

(async () => {
    try {
        initDb(config);
        await runMigrations();
        await ensureDemoSpace(config);
        initNotifier(config);
        
        server.listen(config.port, '0.0.0.0', () => {
            console.log(`🚀 OpenSpatial running on ${protocol}://0.0.0.0:${config.port}`);
        });
    } catch (err) {
        console.error('Startup failed:', err);
        process.exit(1);
    }
})();

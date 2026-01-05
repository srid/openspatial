/*
 * OpenSpatial
 * Copyright (C) 2025 Sridhar Ratnakumar
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */

import express, { Request, Response } from 'express';
import { createServer as createHttpServer, Server as HttpServer } from 'http';
import { createServer as createHttpsServer, Server as HttpsServer } from 'https';
import { Server } from 'socket.io';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { attachSignaling } from './signaling.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3000;
// HTTPS enabled by default, set HTTPS=0 to disable
const USE_HTTPS = process.env.HTTPS !== '0' && process.env.HTTPS !== 'false';

// Serve static files from Vite build
app.use(express.static(join(__dirname, '../dist')));

// SPA fallback for /s/* routes
app.get('/s/*', (_req: Request, res: Response) => {
    res.sendFile(join(__dirname, '../dist/index.html'));
});

let server: HttpServer | HttpsServer;

if (USE_HTTPS) {
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
    }
});

attachSignaling(io);

const protocol = USE_HTTPS ? 'https' : 'http';
server.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 OpenSpatial running on ${protocol}://0.0.0.0:${PORT}`);
});

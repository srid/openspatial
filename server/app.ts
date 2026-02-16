/**
 * OpenSpatial Hono App
 * HTTP routes and middleware. Framework-agnostic — can be mounted
 * on any Node.js HTTP server (dev with Vite, prod standalone).
 */
import { Hono } from 'hono';
import { serveStatic } from '@hono/node-server/serve-static';
import { getIceServers } from './turn-config.js';
import type { ServerConfig } from './config.js';

export function createApp(config: ServerConfig, options?: { isDev?: boolean }) {
  const app = new Hono();

  // API routes
  app.get('/api/ice-servers', (c) => c.json(getIceServers(config.turn)));

  // In production, serve static files from Vite build output
  if (!options?.isDev) {
    // Assets with content hashes get long cache
    app.use('/assets/*', serveStatic({
      root: './dist',
      onFound: (_path, c) => {
        c.header('Cache-Control', 'public, max-age=31536000, immutable');
      },
    }));

    // Other static files
    app.use('*', serveStatic({ root: './dist' }));

    // SPA fallback: any non-API route that wasn't a static file → serve index.html
    app.get('*', serveStatic({ path: './dist/index.html' }));
  }

  return app;
}

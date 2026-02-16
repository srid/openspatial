import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';
import solidPlugin from 'vite-plugin-solid';
import path from 'path';

// Client-only Vite config.
// Server-side concerns (Socket.io, Yjs, DB) are handled by server/main.ts.
// In dev mode, main.ts creates Vite in middleware mode using this config.
export default defineConfig({
  plugins: [
    tailwindcss(),
    solidPlugin(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './client')
    }
  },
});

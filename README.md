<p align="center">
  <img src="./client/assets/logo.svg" alt="OpenSpatial" width="80">
</p>

# OpenSpatial

A virtual space where distance disappears — spatial audio and shared canvas for gatherings of any kind.

## Quick Start

**Run instantly with Nix:**
```bash
# Use HTTPS=0 to disable https.
PORT=443 nix run github:srid/openspatial
```

Open `https://<your-ip>` and accept the self-signed certificate. We also provide a NixOS module.

**Or develop locally:**
```bash
npm install
npm run dev        # Development server
npm run build      # Type check + production build
npm run typecheck  # Type check only
```

Open `https://localhost:5173` and accept the self-signed certificate.

---

## Project Structure

```
shared/           # Shared code (client + server)
  types/events.ts   # Socket event types (the type safety contract)

client/           # Browser code (bundled by Vite)
  main.tsx          # Entry point (Solid.js)
  components/       # Solid.js UI components
  modules/          # Core logic modules
  stores/           # Solid.js reactive stores

server/           # Node.js server
  signaling.ts      # Socket.io signaling (shared between dev & prod)
  standalone.ts     # Production entry point
  yjs-server.ts     # Yjs WebSocket server with SQLite persistence
  db.ts             # Kysely SQLite database operations
```

## Type Safety

All socket events are typed in `shared/types/events.ts`. Both client and server import from this file, so contract mismatches are caught at compile time.

## Architecture

- **Frontend**: Solid.js with Tailwind CSS
- **Dev**: `npm run dev` runs Vite with signaling attached via plugin
- **Prod**: `npm start` runs `server/standalone.ts` which serves static files + signaling
- **Both** import signaling from `server/signaling.ts` and types from `shared/types/events.ts`

### Communication Methods

| Action | Method | Description |
|--------|--------|-------------|
| **Join/Leave Space** | Socket.io | Server assigns peer UUID, broadcasts `peer-joined`/`peer-left` |
| **WebRTC Signaling** (offer/answer/ICE) | Socket.io | Server routes signals to specific target peer |
| **Avatar Position** | CRDT (Yjs) | Synced via y-websocket, persisted in `peers` map |
| **Mute/Video Toggle** | CRDT (Yjs) | Synced via y-websocket, persisted in `peers` map |
| **Status Update** | CRDT (Yjs) | Synced via y-websocket, persisted in `peers` map |
| **Screen Share Tracks** | Socket.io + WebRTC | Socket.io for start/stop signaling, WebRTC for video |
| **Screen Share State** (position/size) | CRDT (Yjs) | Synced via y-websocket, persisted in `screenShares` map |
| **Text Notes** | CRDT (Yjs) + SQLite | Synced via y-websocket, **persisted to SQLite** for durability |
| **Audio/Video Streams** | WebRTC (P2P) | Direct peer-to-peer mesh, spatial audio panning |
| **Screen Share Video** | WebRTC (P2P) | Video frames sent directly between browsers |

### CRDT State (Yjs)

All real-time state synchronization uses Yjs with y-websocket:

- **`peers`** - Avatar positions, media state, status messages
- **`screenShares`** - Screen share positions and sizes
- **`textNotes`** - Text note content, position, size, and styling (persisted to SQLite)

Server-side cleanup removes orphaned entries when peers disconnect. Text notes are hydrated from SQLite when a space is re-joined.

## Deployment

For production deployment to Hetzner Cloud with NixOS, TURN server, and Let's Encrypt SSL, see [deploy/README.md](./deploy/README.md).


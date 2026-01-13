<p align="center">
  <img src="./client/assets/logo.svg" alt="OpenSpatial" width="80">
</p>

# OpenSpatial

A spatial video chat application where participants share a virtual canvas with draggable avatars and screen shares.

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
  main.ts           # Entry point
  modules/          # UI components and handlers

server/           # Node.js server
  signaling.ts      # Socket.io signaling (shared between dev & prod)
  standalone.ts     # Production entry point
```

## Type Safety

All socket events are typed in `shared/types/events.ts`. Both client and server import from this file, so contract mismatches are caught at compile time.

## Architecture

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
| **Text Notes** | CRDT (Yjs) | Synced via y-websocket, persisted in `textNotes` map |
| **Audio/Video Streams** | WebRTC (P2P) | Direct peer-to-peer mesh, spatial audio panning |
| **Screen Share Video** | WebRTC (P2P) | Video frames sent directly between browsers |

### CRDT State (Yjs)

All real-time state synchronization uses Yjs with y-websocket:

- **`peers`** - Avatar positions, media state, status messages
- **`screenShares`** - Screen share positions and sizes
- **`textNotes`** - Text note content, position, size, and styling

Server-side cleanup removes orphaned entries when peers disconnect.

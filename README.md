# OpenSpatial

A spatial video chat application where participants share a virtual canvas with draggable avatars and screen shares.

## Quick Start

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Type check
npm run typecheck

# Build for production
npm run build
```

Open `https://localhost:5173` and accept the self-signed certificate.  
Share the network URL (e.g., `https://192.168.2.12:5173/s/MySpace`) with others.

---

## Architecture (for LLM reference)

### Tech Stack
- **Frontend**: TypeScript + Vite
- **Signaling**: Socket.io (shared module for dev and prod)
- **Media**: WebRTC peer-to-peer connections
- **Deployment**: NixOS module with systemd service

### Type Safety
All socket events are typed in `src/types/events.ts`. Both client and server import from this file, ensuring contract mismatches are caught at compile time.

### Key Modules (`src/modules/`)

| Module | Purpose |
|--------|---------|
| `socket.ts` | Typed Socket.io client with `emit<K>()` and `on<K>()` |
| `webrtc.ts` | Peer connection management, track handling, glare resolution |
| `avatar.ts` | Webcam video circles with drag support |
| `screenshare.ts` | Screen share windows with synced position |
| `canvas.ts` | Pan/zoom for the canvas |
| `minimap.ts` | Navigation minimap with element indicators |
| `spatial-audio.ts` | Distance-based audio via Web Audio API |

### Signaling Events
- `join-space` / `space-state` - Space membership
- `signal` - WebRTC offer/answer/ICE (routed to specific peer via `peerSockets` map)
- `position-update` - Avatar position sync
- `screen-share-position-update` - Screen share position sync
- `screen-share-started/stopped` - Screen share lifecycle

### State Flow
1. User joins space → server assigns `peerId`, broadcasts to peers
2. Peers establish WebRTC connections (polite peer pattern for glare)
3. Tracks received via `ontrack` → classified by stream ID (webcam vs screen share)
4. Position changes emit via socket → broadcast to space → `setPosition()` on remote elements

# OpenSpatial

A spatial video chat application where participants share a virtual canvas with draggable avatars and screen shares.

## Quick Start

```bash
# Install dependencies
npm install

# Run development server
npm run dev
```

Open `https://localhost:5173` and accept the self-signed certificate.  
Share the network URL (e.g., `https://192.168.2.12:5173/s/MySpace`) with others.

---

## Architecture (for LLM reference)

### Tech Stack
- **Frontend**: Vanilla JS + Vite
- **Signaling**: Socket.io integrated into Vite dev server
- **Media**: WebRTC peer-to-peer connections

### Key Modules (`src/modules/`)

| Module | Purpose |
|--------|---------|
| `socket.js` | Socket.io client wrapper |
| `webrtc.js` | Peer connection management, track handling, glare resolution |
| `avatar.js` | Webcam video circles with drag support |
| `screenshare.js` | Screen share windows with synced position |
| `canvas.js` | Pan/zoom for the canvas |
| `minimap.js` | Navigation minimap with element indicators |
| `spatial-audio.js` | Distance-based audio via Web Audio API |

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

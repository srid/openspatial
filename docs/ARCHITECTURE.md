# OpenSpatial Architecture

This document provides a complete overview of the OpenSpatial application architecture.

## High-Level Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                           OpenSpatial                                │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────────────┐   │
│  │   Browser    │◄──►│   Server     │◄──►│   SQLite Database    │   │
│  │  (SolidJS)   │    │  (Node.js)   │    │   (via Kysely)       │   │
│  └──────────────┘    └──────────────┘    └──────────────────────┘   │
│         │                   │                                        │
│         │    Socket.io      │                                        │
│         │◄─────────────────►│                                        │
│         │                   │                                        │
│         │    y-websocket    │                                        │
│         │◄─────────────────►│                                        │
│         │                   │                                        │
│         │    WebRTC P2P     │                                        │
│         │◄─────────────────►│ (TURN relay if needed)                │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

## Directory Structure

```
openspatial/
├── client/                     # SolidJS Frontend
│   ├── App.tsx                 # Root component with view routing
│   ├── main.tsx                # Entry point
│   ├── index.css               # All styles
│   ├── context/
│   │   └── SpaceContext.tsx    # Central state & connection manager
│   ├── components/
│   │   ├── Canvas/             # Avatar, Canvas, ScreenShare, TextNote
│   │   └── Controls/           # ControlBar, ActivityPanel
│   └── hooks/                  # useLocalMedia, useResizable
│
├── server/                     # Node.js Backend
│   ├── standalone.ts           # Production server entry
│   ├── signaling.ts            # Socket.io handlers
│   ├── yjs-server.ts           # y-websocket server
│   ├── db.ts                   # Database operations
│   └── notifier/               # Slack notifications
│
├── shared/                     # Shared Types
│   ├── types/events.ts         # Socket event types
│   └── yjs-schema.ts           # CRDT document schema
│
└── e2e/                        # End-to-End Tests
    ├── dsl/                    # Test DSL framework
    └── scenarios/              # Test files
```

## State Sync Strategy

```
┌─────────────────────────────────────────────────────────────┐
│  Socket.io (signaling):                                      │
│  - Peer join/leave events                                    │
│  - WebRTC offer/answer/ICE exchange                          │
│  - Screen share start/stop announcements                     │
│                                                              │
│  Yjs CRDT (y-websocket):                                     │
│  - Peer positions (x, y)                                     │
│  - Media state (isMuted, isVideoOff)                         │
│  - Status messages                                           │
│  - Screen share positions and sizes                          │
│  - Text note content, positions, styles                      │
└─────────────────────────────────────────────────────────────┘
```

## Component Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        App.tsx                               │
│  ┌─────────────────────────────────────────────────────────┐│
│  │                   SpaceProvider                          ││
│  │  (manages: socket, CRDT, WebRTC, all state)             ││
│  │                                                          ││
│  │  view === 'landing' → Landing                            ││
│  │  view === 'join'    → JoinModal                          ││
│  │  view === 'space'   → Canvas + ControlBar                ││
│  └─────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
```

## Type Safety

All socket events are typed in `shared/types/events.ts`. Both client and server import from this file, so contract mismatches are caught at compile time.

## Key Technologies

| Layer | Technology | Purpose |
|-------|------------|---------|
| Frontend | SolidJS | Reactive UI framework |
| Styling | Vanilla CSS | No dependencies |
| Signaling | Socket.io | Real-time events |
| CRDT | Yjs + y-websocket | Conflict-free state sync |
| Media | WebRTC | P2P audio/video |
| Server | Node.js + Vite | Dev server + HMR |
| Database | SQLite + Kysely | Persistence |
| Testing | Playwright | E2E tests |
| Packaging | Nix | Reproducible builds |

## SpaceContext

The central state manager (`client/context/SpaceContext.tsx`) handles:

- **View state**: `'landing' | 'join' | 'space'`
- **Session state**: Current user, space ID, media stream
- **Connection state**: Socket.io and CRDT sync status
- **Peer state**: Reactive `Map<peerId, PeerState>` from CRDT
- **Media streams**: Peer webcam and screen share streams
- **CRDT mutations**: All state updates go through context methods

## Communication Methods

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

## CRDT State (Yjs)

All real-time state synchronization uses Yjs with y-websocket:

- **`peers`** - Avatar positions, media state, status messages
- **`screenShares`** - Screen share positions and sizes
- **`textNotes`** - Text note content, position, size, and styling

Server-side cleanup removes orphaned entries when peers disconnect.

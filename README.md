# OpenSpatial

A spatial video chat application where participants share a virtual canvas with draggable avatars and screen shares.

## Quick Start

**Run instantly with Nix:**
```bash
nix run github:srid/openspatial
# Or with custom port:
PORT=8080 nix run github:srid/openspatial
```

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

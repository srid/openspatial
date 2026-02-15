<p align="center">
  <img src="./public/logo.svg" alt="OpenSpatial" width="80">
</p>

# OpenSpatial

[![Build](https://github.com/srid/openspatial/actions/workflows/build.yml/badge.svg)](https://github.com/srid/openspatial/actions/workflows/build.yml)
[![License: AGPL-3.0](https://img.shields.io/badge/License-AGPL--3.0-blue.svg)](./LICENSE)
[![Live Demo](https://img.shields.io/badge/demo-spatial.srid.ca-brightgreen)](https://spatial.srid.ca/s/demo)

A virtual space where distance disappears — spatial audio and shared canvas for gatherings of any kind.

## Features

- 🎙️ **Spatial audio** — volume and panning change with distance between avatars
- 🖥️ **Screen sharing** — drag, resize, and position streams on the canvas
- 📝 **Collaborative notes** — real-time markdown editing with live sync
- 🔄 **Conflict-free sync** — powered by [Yjs](https://yjs.dev/) CRDTs
- 📦 **One-command deploy** — `nix run github:srid/openspatial`

## Quick Start

**Run instantly with Nix:**
```bash
# Set environment variable HTTPS=0 to disable https.
nix run github:srid/openspatial
```

Open `https://<your-ip>:<port>` and accept the self-signed certificate. 

We also provide a NixOS module. See [Deployment](#deployment).

**Or develop locally:**
```bash
npm install
npm run dev        # Development server
npm run build      # Type check + production build
npm run typecheck  # Type check only
```

Open `https://localhost:5173` and accept the self-signed certificate.

## Architecture

See [ARCHITECTURE.md](./docs/ARCHITECTURE.md) for the full technical architecture including state sync, CRDT schema, and component design.

**Quick overview:**
- **Frontend**: SolidJS with centralized SpaceContext
- **Sync**: Socket.io for signaling + Yjs CRDT for state
- **Media**: WebRTC peer-to-peer mesh with spatial audio

## Deployment

For production deployment to Hetzner Cloud with NixOS, TURN server, and Let's Encrypt SSL, see [deploy/README.md](./deploy/README.md).

## Configuration

**Slack notifications** — get live presence alerts in Slack when spaces become active. See [docs/slack-notifications.md](./docs/slack-notifications.md) for setup.

**NixOS module** — deploy as a systemd service with nginx and optional TURN relay:

```nix
services.openspatial = {
  enable = true;
  domain = "spatial.example.com";
};
```

## License

[AGPL-3.0](./LICENSE)

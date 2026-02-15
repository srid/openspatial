<p align="center">
  <img src="./public/logo.svg" alt="OpenSpatial" width="80">
</p>

# OpenSpatial

A virtual space where distance disappears — spatial audio and shared canvas for gatherings of any kind.

Live demo: https://spatial.srid.ca/s/demo

> [!TIP]
> Want to use [spatial.srid.ca](https://spatial.srid.ca/) for your spaces? [Contact me](https://x.com/sridca)!

## Quick Start

**Run instantly with Nix:**
```bash
# Set environment variable HTTPS=0 to disable https.
nix run github:srid/openspatial
```

Open `https://<your-ip>:<port>` and accept the self-signed certificate. 

We also provide a NixOS module. See below.

**Or develop locally:**
```bash
npm install
npm run dev        # Development server
npm run build      # Type check + production build
npm run typecheck  # Type check only
```

Open `https://localhost:5173` and accept the self-signed certificate.

---

## Architecture

See [ARCHITECTURE.md](./ARCHITECTURE.md) for the full technical architecture including state sync, CRDT schema, and component design.

**Quick overview:**
- **Frontend**: SolidJS with centralized SpaceContext
- **Sync**: Socket.io for signaling + Yjs CRDT for state
- **Media**: WebRTC peer-to-peer mesh with spatial audio

## Slack Notifications

Live presence notifications in Slack — shows a 🟢 LIVE message when a space becomes active, updates to ⚫ ended when everyone leaves. Join/leave events appear as threaded replies.

### Slack App Setup

1. Go to [api.slack.com/apps](https://api.slack.com/apps) → **Create New App** → **From scratch**
2. Name it (e.g., "OpenSpatial") and select your workspace
3. **OAuth & Permissions** → **Bot Token Scopes** → add `chat:write` and `chat:write.public`
4. **Install to Workspace** → approve permissions
5. Copy the **Bot User OAuth Token** (`xoxb-...`) from the OAuth page
6. Get the **Channel ID**: right-click the target channel → "View channel details" → ID at the bottom

### Local Development

```bash
SLACK_BOT_TOKEN="xoxb-..." \
SLACK_CHANNEL_ID="C01ABCDEF23" \
SLACK_BASE_URL="https://localhost:5173" \
npm run dev
```

### NixOS Module

```nix
services.openspatial = {
  enable = true;
  domain = "spatial.example.com";
  notifications.slack = {
    enable = true;
    botTokenFile = "/run/secrets/slack-bot-token";
    channelId = "C01ABCDEF23";
    spaces = [ "jusnix" ];  # Only notify for these spaces (empty = all)
  };
};
```

## Deployment

For production deployment to Hetzner Cloud with NixOS, TURN server, and Let's Encrypt SSL, see [deploy/README.md](./deploy/README.md).


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

## Architecture

See [ARCHITECTURE.md](./ARCHITECTURE.md) for the full technical architecture including state sync, CRDT schema, and component design.

**Quick overview:**
- **Frontend**: SolidJS with centralized SpaceContext
- **Sync**: Socket.io for signaling + Yjs CRDT for state
- **Media**: WebRTC peer-to-peer mesh with spatial audio

## Slack Notifications

Get notified in Slack when spaces become active.

### Setup

1. Go to [api.slack.com/apps](https://api.slack.com/apps) → **Create New App** → **From scratch**
2. Name it (e.g., "OpenSpatial") and select your workspace
3. Click **Incoming Webhooks** → Toggle **Activate** to ON
4. Click **Add New Webhook to Workspace** → Select channel → **Allow**
5. Copy the webhook URL

### Local Development

```bash
SLACK_WEBHOOK_URL="https://hooks.slack.com/services/..." \
SLACK_BASE_URL="https://localhost:5173" \
npm run dev
```

### NixOS Module

```nix
services.openspatial = {
  enable = true;
  domain = "spatial.example.com";  # Used for TURN realm and Slack links
  notifications.slack = {
    enable = true;
    webhookUrlFile = "/run/secrets/slack-webhook";  # Keep secret!
    spaces = [ "jusnix" ];  # Only notify for these spaces (empty = all)
  };
};
```

## Deployment

For production deployment to Hetzner Cloud with NixOS, TURN server, and Let's Encrypt SSL, see [deploy/README.md](./deploy/README.md).


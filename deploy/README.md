# Hetzner Cloud Deployment

Deploy OpenSpatial to a Hetzner Cloud VM using NixOS.

## Quick Start

```bash
# Initial deployment (wipes disk!)
nix run .#deploy -- root@<server-ip>

# Update existing server
nix run .#redeploy -- root@<server-ip>
```

## Post-Deployment

```bash
ssh root@<server-ip>

# TURN secret
openssl rand -hex 32 > /etc/openspatial/turn-secret

# Slack webhook (get from api.slack.com/apps → Incoming Webhooks)
echo "https://hooks.slack.com/services/YOUR/WEBHOOK/URL" > /etc/openspatial/slack-webhook

systemctl restart openspatial coturn
```

## Files

| File | Purpose |
|------|---------|
| `configuration.nix` | Main NixOS config (openspatial, nginx, coturn) |
| `hardware-configuration.nix` | Hetzner QEMU guest settings |
| `disko-config.nix` | Disk partitioning (GPT, ESP, ext4) |

## Services

- **openspatial** - Main app on port 3000 (behind nginx)
- **coturn** - TURN relay on port 3478
- **nginx** - Reverse proxy with Let's Encrypt SSL

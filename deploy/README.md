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

# Slack bot token (see docs/slack-notifications.md for setup)
echo "xoxb-your-bot-token" > /etc/openspatial/slack-bot-token

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

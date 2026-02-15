# Slack Notifications

Live presence notifications in Slack — shows a 🟢 LIVE message when a space becomes active, updates to ⚫ ended when everyone leaves. Join/leave events appear as threaded replies.

## Slack App Setup

1. Go to [api.slack.com/apps](https://api.slack.com/apps) → **Create New App** → **From scratch**
2. Name it (e.g., "OpenSpatial") and select your workspace
3. **OAuth & Permissions** → **Bot Token Scopes** → add `chat:write` and `chat:write.public`
4. **Install to Workspace** → approve permissions
5. Copy the **Bot User OAuth Token** (`xoxb-...`) from the OAuth page
6. Get the **Channel ID**: right-click the target channel → "View channel details" → ID at the bottom

## Local Development

```bash
SLACK_BOT_TOKEN="xoxb-..." \
SLACK_CHANNEL_ID="C01ABCDEF23" \
SLACK_BASE_URL="https://localhost:5173" \
npm run dev
```

## NixOS Module

```nix
services.openspatial = {
  enable = true;
  domain = "spatial.example.com";
  notifications.slack = {
    enable = true;
    botTokenFile = "/run/secrets/slack-bot-token";
    channelId = "C01ABCDEF23";
    spaces = [ "myspace" ];  # Only notify for these spaces (empty = all)
  };
};
```

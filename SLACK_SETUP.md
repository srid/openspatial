# Slack App: Adding Bot Token for Live Messages

Your existing Slack app uses **Incoming Webhooks** (append-only). To support live messages that update when a space empties, you need to add **Bot Token** capabilities to the same app.

## Steps

### 1. Open your app settings

Go to **[api.slack.com/apps](https://api.slack.com/apps)** → click your existing app

### 2. Add Bot Token Scopes

**OAuth & Permissions** (left sidebar) → scroll to **"Scopes"** → **Bot Token Scopes** section → click **"Add an OAuth Scope"**

Add these two scopes:

| Scope | Why |
|---|---|
| `chat:write` | Post messages as the bot |
| `chat:write.public` | Post to channels without being invited first |

### 3. Reinstall the app

After adding scopes, a yellow banner appears at the top:

> "You've changed the permission scopes... **reinstall your app**"

Click **"reinstall to workspace"** → approve the new permissions.

> [!IMPORTANT]
> This is the step that may require **admin approval** if your workspace has app approval enabled.

### 4. Copy the Bot Token

Still on **OAuth & Permissions** page → find **"Bot User OAuth Token"** at the top.

It starts with `xoxb-`. Copy this — it replaces your webhook URL in the NixOS config.

### 5. Get the Channel ID

In Slack desktop/web:
1. Right-click the channel where you want live messages
2. Click **"View channel details"**
3. At the very bottom of the panel, you'll see the **Channel ID** (e.g., `C01ABCDEF23`)

### 6. Update NixOS config

Replace the old webhook config with:

```nix
services.openspatial.notifications.slack = {
  enable = true;
  botTokenFile = "/path/to/slack-bot-token";  # file containing xoxb-...
  channelId = "C01ABCDEF23";                  # from step 5
  spaces = [ "your-space" ];                  # optional allow-list
};
```

Write the bot token to the secret file:
```bash
echo "xoxb-your-token-here" > /path/to/slack-bot-token
chmod 600 /path/to/slack-bot-token
```

> [!NOTE]
> The old `webhookUrlFile` option no longer exists — the bot token replaces it entirely. The Incoming Webhook can stay enabled on the Slack app; it just won't be used anymore.

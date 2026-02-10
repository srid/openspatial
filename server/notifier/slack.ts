/**
 * Slack notification backend using Bot Token API.
 * Uses chat.postMessage to send live messages and chat.update to mark them ended.
 */
import type { NotificationBackend, SpaceNotification, SpaceInactiveNotification } from './types.js';

export interface SlackConfig {
  /** Slack Bot User OAuth Token (xoxb-...) */
  botToken: string;
  /** Slack channel ID to post messages to */
  channelId: string;
}

interface SlackPostMessageResponse {
  ok: boolean;
  ts?: string;
  error?: string;
}

export class SlackBackend implements NotificationBackend {
  readonly name = 'slack';
  
  constructor(private config: SlackConfig) {}

  /** Shared message format: {icon} {status} — Space "name" (by *user*) — {detail} — Join */
  private formatMessage(icon: string, status: string, spaceId: string, username: string, joinUrl: string, detail?: string): string {
    const parts = [`${icon} *${status}* — Space "${spaceId}" (by *${username}*)`];
    if (detail) parts.push(detail);
    parts.push(`<${joinUrl}|Join>`);
    return parts.join(' — ');
  }
  
  async notifySpaceActive(notification: SpaceNotification): Promise<string | null> {
    const text = this.formatMessage('🟢', 'LIVE', notification.spaceId, notification.username, notification.joinUrl);
    
    try {
      const response = await fetch('https://slack.com/api/chat.postMessage', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.config.botToken}`,
        },
        body: JSON.stringify({
          channel: this.config.channelId,
          text,
        }),
      });
      
      const data = await response.json() as SlackPostMessageResponse;
      
      if (!data.ok) {
        console.error(`[Slack] Failed to send notification: ${data.error}`);
        return null;
      }
      
      console.log(`[Slack] Live message posted for space ${notification.spaceId} (ts: ${data.ts})`);
      return data.ts ?? null;
    } catch (error) {
      console.error(`[Slack] Error sending notification:`, error);
      return null;
    }
  }

  async notifySpaceInactive(notification: SpaceInactiveNotification): Promise<void> {
    const duration = formatDuration(notification.durationMs);
    const text = this.formatMessage('⚫', 'ENDED', notification.spaceId, notification.username, notification.joinUrl, `was live for ${duration}`);
    
    try {
      const response = await fetch('https://slack.com/api/chat.update', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.config.botToken}`,
        },
        body: JSON.stringify({
          channel: this.config.channelId,
          ts: notification.messageId,
          text,
        }),
      });
      
      const data = await response.json() as SlackPostMessageResponse;
      
      if (!data.ok) {
        console.error(`[Slack] Failed to update message: ${data.error}`);
        return;
      }
      
      console.log(`[Slack] Live message updated to ended for space ${notification.spaceId}`);
    } catch (error) {
      console.error(`[Slack] Error updating message:`, error);
    }
  }

  /**
   * Post a threaded reply to the live message.
   * Used for join/leave events during an active session.
   */
  async postThreadReply(threadTs: string, text: string): Promise<void> {
    try {
      const response = await fetch('https://slack.com/api/chat.postMessage', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.config.botToken}`,
        },
        body: JSON.stringify({
          channel: this.config.channelId,
          thread_ts: threadTs,
          text,
        }),
      });
      
      const data = await response.json() as SlackPostMessageResponse;
      
      if (!data.ok) {
        console.error(`[Slack] Failed to post thread reply: ${data.error}`);
      }
    } catch (error) {
      console.error(`[Slack] Error posting thread reply:`, error);
    }
  }
}

/**
 * Format milliseconds into a human-readable duration string.
 */
function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
}

/**
 * Create a Slack backend from environment variables.
 * Returns null if Slack is not configured.
 */
export function createSlackBackendFromEnv(): SlackBackend | null {
  const botToken = process.env.SLACK_BOT_TOKEN;
  const channelId = process.env.SLACK_CHANNEL_ID;
  if (!botToken || !channelId) {
    return null;
  }
  
  return new SlackBackend({ botToken, channelId });
}

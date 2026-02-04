/**
 * Slack notification backend using incoming webhooks.
 */
import type { NotificationBackend, SpaceNotification } from './types.js';

export interface SlackConfig {
  /** Slack incoming webhook URL */
  webhookUrl: string;
}

interface SlackMessage {
  text: string;
}

export class SlackBackend implements NotificationBackend {
  readonly name = 'slack';
  
  constructor(private config: SlackConfig) {}
  
  async notifySpaceActive(notification: SpaceNotification): Promise<string | null> {
    const message: SlackMessage = {
      text: `🟢 Space "${notification.spaceId}" is now active (by *${notification.username}*) — <${notification.joinUrl}|Join>`,
    };
    
    try {
      const response = await fetch(this.config.webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(message),
      });
      
      if (!response.ok) {
        console.error(`[Slack] Failed to send notification: ${response.status} ${response.statusText}`);
        return null;
      }
      
      // Slack incoming webhooks don't return thread_ts in the response body
      // They just return "ok" as plain text. For threading, we'd need to use
      // the chat.postMessage API with a bot token instead.
      // For now, we'll store our own identifier and handle threading differently.
      const messageId = `${notification.spaceId}-${Date.now()}`;
      console.log(`[Slack] Notification sent for space ${notification.spaceId}`);
      return messageId;
    } catch (error) {
      console.error(`[Slack] Error sending notification:`, error);
      return null;
    }
  }
}

/**
 * Create a Slack backend from environment variables.
 * Returns null if Slack is not configured.
 */
export function createSlackBackendFromEnv(): SlackBackend | null {
  const webhookUrl = process.env.SLACK_WEBHOOK_URL;
  if (!webhookUrl) {
    return null;
  }
  
  return new SlackBackend({ webhookUrl });
}

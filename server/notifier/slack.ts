/**
 * Slack notification backend using incoming webhooks.
 */
import type { NotificationBackend, SpaceNotification } from './types.js';

export interface SlackConfig {
  /** Default webhook URL (used when no space-specific destination) */
  defaultWebhookUrl: string;
  /** Map of spaceId to specific webhook URL */
  spaceDestinationMap?: Record<string, string>;
}

interface SlackMessage {
  text: string;
  thread_ts?: string;
}

interface SlackResponse {
  ok?: boolean;
  ts?: string;
  error?: string;
}

export class SlackBackend implements NotificationBackend {
  readonly name = 'slack';
  
  constructor(private config: SlackConfig) {}
  
  private getWebhookUrl(spaceId: string): string {
    return this.config.spaceDestinationMap?.[spaceId] ?? this.config.defaultWebhookUrl;
  }
  
  async notifySpaceActive(notification: SpaceNotification): Promise<string | null> {
    const webhookUrl = this.getWebhookUrl(notification.spaceId);
    
    const message: SlackMessage = {
      text: [
        `🟢 Space "${notification.spaceId}" is now active!`,
        `*${notification.username}* just joined.`,
        `→ <${notification.joinUrl}|Join now>`,
      ].join('\n'),
    };
    
    try {
      const response = await fetch(webhookUrl, {
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
  
  async notifySpaceEmpty(spaceId: string, _originalMessageId: string): Promise<void> {
    const webhookUrl = this.getWebhookUrl(spaceId);
    
    // Note: Slack incoming webhooks don't support threading.
    // For proper thread replies, we'd need to use the Slack Web API with a bot token.
    // For now, we send a standalone message indicating the space is empty.
    const message: SlackMessage = {
      text: `🔴 Space "${spaceId}" is now empty.`,
    };
    
    try {
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(message),
      });
      
      if (!response.ok) {
        console.error(`[Slack] Failed to send empty notification: ${response.status}`);
        return;
      }
      
      console.log(`[Slack] Empty notification sent for space ${spaceId}`);
    } catch (error) {
      console.error(`[Slack] Error sending empty notification:`, error);
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
  
  // Parse space destination map from JSON env var
  let spaceDestinationMap: Record<string, string> | undefined;
  const mapJson = process.env.SLACK_SPACE_DESTINATION_MAP;
  if (mapJson) {
    try {
      spaceDestinationMap = JSON.parse(mapJson);
    } catch (e) {
      console.error('[Slack] Failed to parse SLACK_SPACE_DESTINATION_MAP:', e);
    }
  }
  
  return new SlackBackend({
    defaultWebhookUrl: webhookUrl,
    spaceDestinationMap,
  });
}

/**
 * Notifier orchestration - manages notification backends and state.
 */
import type { NotificationBackend, NotifierConfig, SpaceNotification } from './types.js';
import { createSlackBackendFromEnv } from './slack.js';

/** Tracks active notifications for threading and cooldown */
interface ActiveNotification {
  messageId: string;
  timestamp: number;
  backend: NotificationBackend;
}

/** Global notifier state */
const activeNotifications = new Map<string, ActiveNotification>();
let notifierConfig: NotifierConfig | null = null;

/**
 * Initialize the notifier system from environment variables.
 */
export function initNotifier(): void {
  const backends: NotificationBackend[] = [];
  
  // Initialize Slack backend if configured
  const slackBackend = createSlackBackendFromEnv();
  if (slackBackend) {
    backends.push(slackBackend);
    console.log('[Notifier] Slack backend enabled');
  }
  
  // Future: Add more backends here (Discord, email, etc.)
  
  if (backends.length === 0) {
    console.log('[Notifier] No notification backends configured');
    return;
  }
  
  const cooldownMs = parseInt(process.env.SLACK_COOLDOWN_MS || '60000', 10);
  const baseUrl = process.env.SLACK_BASE_URL || process.env.BASE_URL || '';
  
  // Parse allowed spaces (comma-separated list, empty means all)
  const spacesEnv = process.env.SLACK_SPACES;
  const allowedSpaces = spacesEnv ? spacesEnv.split(',').map(s => s.trim()) : null;
  
  notifierConfig = {
    backends,
    cooldownMs,
    baseUrl,
    allowedSpaces,
  };
  
  const spacesInfo = allowedSpaces ? `spaces: [${allowedSpaces.join(', ')}]` : 'all spaces';
  console.log(`[Notifier] Initialized with ${backends.length} backend(s), ${spacesInfo}, cooldown: ${cooldownMs}ms`);
}

/**
 * Notify that a space became active (first user joined).
 * Respects cooldown to prevent spam.
 */
export async function notifySpaceActive(spaceId: string, username: string): Promise<void> {
  if (!notifierConfig || notifierConfig.backends.length === 0) {
    return;
  }
  
  // Check if this space is in the allowed list (null means all allowed)
  if (notifierConfig.allowedSpaces && !notifierConfig.allowedSpaces.includes(spaceId)) {
    return;
  }
  
  // Check cooldown
  const existing = activeNotifications.get(spaceId);
  if (existing) {
    const elapsed = Date.now() - existing.timestamp;
    if (elapsed < notifierConfig.cooldownMs) {
      console.log(`[Notifier] Skipping notification for ${spaceId} (cooldown: ${Math.round((notifierConfig.cooldownMs - elapsed) / 1000)}s remaining)`);
      return;
    }
  }
  
  const notification: SpaceNotification = {
    spaceId,
    username,
    joinUrl: notifierConfig.baseUrl ? `${notifierConfig.baseUrl}/${spaceId}` : spaceId,
  };
  
  // Notify all backends
  for (const backend of notifierConfig.backends) {
    try {
      const messageId = await backend.notifySpaceActive(notification);
      if (messageId) {
        activeNotifications.set(spaceId, {
          messageId,
          timestamp: Date.now(),
          backend,
        });
      }
    } catch (error) {
      console.error(`[Notifier] Error in ${backend.name} backend:`, error);
    }
  }
}

/**
 * Notify that a space became empty (last user left).
 * Sends as a reply to the original "active" notification when supported.
 */
export async function notifySpaceEmpty(spaceId: string): Promise<void> {
  if (!notifierConfig || notifierConfig.backends.length === 0) {
    return;
  }
  
  const existing = activeNotifications.get(spaceId);
  if (!existing) {
    // No active notification to reply to - this happens if:
    // - The server restarted while space was active
    // - Notifications were disabled when space became active
    console.log(`[Notifier] No active notification found for ${spaceId}, skipping empty notification`);
    return;
  }
  
  try {
    await existing.backend.notifySpaceEmpty(spaceId, existing.messageId);
  } catch (error) {
    console.error(`[Notifier] Error sending empty notification:`, error);
  }
  
  // Keep the notification in the map for cooldown purposes
  // It will be overwritten when the space becomes active again
}

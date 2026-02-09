/**
 * Notifier orchestration - manages notification backends and state.
 * Cooldown is now tracked in notification_log table to survive restarts
 * and be independent of space event recording.
 *
 * Live message tracking: maps spaceId -> { messageId, startedAt } for
 * updating the Slack message when the space becomes inactive.
 */
import type { NotificationBackend, NotifierConfig, SpaceNotification } from './types.js';
import { createSlackBackendFromEnv } from './slack.js';
import { getLastNotificationTime, recordNotification } from '../db.js';

let notifierConfig: NotifierConfig | null = null;

/** Track active live messages per space for later update */
interface LiveMessage {
  /** Backend-specific message ID (e.g., Slack ts) */
  messageId: string;
  /** When the space became active (ms since epoch) */
  startedAt: number;
  /** Which backend posted this message */
  backend: NotificationBackend;
}
const liveMessages = new Map<string, LiveMessage>();

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
 * Respects cooldown using notification_log table to survive restarts
 * and be independent of space event recording order.
 */
export async function notifySpaceActive(spaceId: string, username: string): Promise<void> {
  if (!notifierConfig || notifierConfig.backends.length === 0) {
    return;
  }
  
  // Check if this space is in the allowed list (null means all allowed)
  if (notifierConfig.allowedSpaces && !notifierConfig.allowedSpaces.includes(spaceId)) {
    return;
  }
  
  // Check cooldown from notification_log (last notification time for this space)
  const lastTime = await getLastNotificationTime(spaceId);
  if (lastTime) {
    const elapsed = Date.now() - lastTime;
    if (elapsed < notifierConfig.cooldownMs) {
      console.log(`[Notifier] Skipping notification for ${spaceId} (cooldown: ${Math.round((notifierConfig.cooldownMs - elapsed) / 1000)}s remaining)`);
      return;
    }
  }
  
  const notification: SpaceNotification = {
    spaceId,
    username,
    joinUrl: notifierConfig.baseUrl ? `${notifierConfig.baseUrl}/s/${spaceId}` : spaceId,
  };
  
  // Notify all backends
  for (const backend of notifierConfig.backends) {
    try {
      const messageId = await backend.notifySpaceActive(notification);
      
      // Only record and track on successful send
      if (messageId) {
        await recordNotification(spaceId, username);
        console.log(`[Notifier] Recorded notification for ${spaceId}`);
        
        liveMessages.set(spaceId, {
          messageId,
          startedAt: Date.now(),
          backend,
        });
      }
    } catch (error) {
      console.error(`[Notifier] Error in ${backend.name} backend:`, error);
    }
  }
}

/**
 * Notify that a space became inactive (last user left).
 * Updates the live message to show session ended with duration.
 */
export async function notifySpaceInactive(spaceId: string): Promise<void> {
  const live = liveMessages.get(spaceId);
  if (!live) {
    return;
  }
  
  const durationMs = Date.now() - live.startedAt;
  liveMessages.delete(spaceId);
  
  try {
    await live.backend.notifySpaceInactive({
      messageId: live.messageId,
      spaceId,
      durationMs,
    });
  } catch (error) {
    console.error(`[Notifier] Error updating live message for ${spaceId}:`, error);
  }
}

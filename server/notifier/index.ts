/**
 * Notifier orchestration - manages notification backends and live message state.
 *
 * Live message tracking: maps spaceId -> { messageId, startedAt } for
 * updating the Slack message when the space becomes inactive.
 */
import type { NotificationBackend, NotifierConfig, SpaceNotification } from './types.js';
import { createSlackBackendFromEnv } from './slack.js';

let notifierConfig: NotifierConfig | null = null;

/** Track active live messages per space for later update */
interface LiveMessage {
  /** Backend-specific message ID (e.g., Slack ts) */
  messageId: string;
  /** Username who started the session */
  username: string;
  /** Join URL for the space */
  joinUrl: string;
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
  
  const baseUrl = process.env.SLACK_BASE_URL || process.env.BASE_URL || '';
  
  // Parse allowed spaces (comma-separated list, empty means all)
  const spacesEnv = process.env.SLACK_SPACES;
  const allowedSpaces = spacesEnv ? spacesEnv.split(',').map(s => s.trim()) : null;
  
  notifierConfig = {
    backends,
    baseUrl,
    allowedSpaces,
  };
  
  const spacesInfo = allowedSpaces ? `spaces: [${allowedSpaces.join(', ')}]` : 'all spaces';
  console.log(`[Notifier] Initialized with ${backends.length} backend(s), ${spacesInfo}`);
}

/**
 * Notify that a space became active (first user joined).
 * Stores the returned message ID for later updates.
 */
export async function notifySpaceActive(spaceId: string, username: string): Promise<void> {
  if (!notifierConfig || notifierConfig.backends.length === 0) {
    return;
  }
  
  // Check if this space is in the allowed list (null means all allowed)
  if (notifierConfig.allowedSpaces && !notifierConfig.allowedSpaces.includes(spaceId)) {
    return;
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
      
      // Only track on successful send
      if (messageId) {
        console.log(`[Notifier] Live message posted for ${spaceId}`);
        
        liveMessages.set(spaceId, {
          messageId,
          username,
          joinUrl: notification.joinUrl,
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
      username: live.username,
      joinUrl: live.joinUrl,
      durationMs,
    });
  } catch (error) {
    console.error(`[Notifier] Error updating live message for ${spaceId}:`, error);
  }
}

/**
 * Post a threaded reply when a user joins an already-active space.
 * (The first joiner's name is already in the live message itself.)
 */
export async function notifyUserJoined(spaceId: string, username: string): Promise<void> {
  const live = liveMessages.get(spaceId);
  if (!live) return;
  
  const { SlackBackend } = await import('./slack.js');
  if (live.backend instanceof SlackBackend) {
    await live.backend.postThreadReply(live.messageId, `👋 *${username}* joined`);
  }
}

/**
 * Post a threaded reply when a user leaves (but the space is still active).
 */
export async function notifyUserLeft(spaceId: string, username: string): Promise<void> {
  const live = liveMessages.get(spaceId);
  if (!live) return;
  
  const { SlackBackend } = await import('./slack.js');
  if (live.backend instanceof SlackBackend) {
    await live.backend.postThreadReply(live.messageId, `🚪 *${username}* left`);
  }
}

/**
 * Notifier orchestration - manages notification backends and live message state.
 *
 * Live message tracking: maps spaceId -> { messageId, startedAt } for
 * updating the Slack message when the space becomes inactive.
 *
 * Live messages are persisted to SQLite so that on server restart,
 * orphaned LIVE messages are updated to ENDED before new connections arrive.
 */
import type { NotificationBackend, NotifierConfig, SpaceNotification } from './types.js';
import { SlackBackend } from './slack.js';
import type { ServerConfig } from '../config.js';
import { saveLiveMessage, deleteLiveMessage, getAllLiveMessages } from '../db.js';

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
 * Initialize the notifier system from server config.
 * Also recovers any orphaned live messages from a previous server instance.
 */
export async function initNotifier(config: ServerConfig): Promise<void> {
  const backends: NotificationBackend[] = [];
  
  // Initialize Slack backend if configured
  if (config.slack.botToken && config.slack.channelId) {
    backends.push(new SlackBackend({
      botToken: config.slack.botToken,
      channelId: config.slack.channelId,
    }));
    console.log('[Notifier] Slack backend enabled');
  }
  
  // Future: Add more backends here (Discord, email, etc.)
  
  if (backends.length === 0) {
    console.log('[Notifier] No notification backends configured');
    return;
  }
  
  notifierConfig = {
    backends,
    baseUrl: config.slack.baseUrl,
    allowedSpaces: config.slack.spaces,
  };
  
  const spacesInfo = config.slack.spaces ? `spaces: [${config.slack.spaces.join(', ')}]` : 'all spaces';
  console.log(`[Notifier] Initialized with ${backends.length} backend(s), ${spacesInfo}`);

  // Recover orphaned live messages from previous server instance
  await recoverLiveMessages(backends);
}

/**
 * Close out any live messages left over from a previous server process.
 * Each orphaned LIVE message is updated to ENDED and removed from the DB.
 */
async function recoverLiveMessages(backends: NotificationBackend[]): Promise<void> {
  const orphaned = await getAllLiveMessages();
  if (orphaned.length === 0) return;

  console.log(`[Notifier] Recovering ${orphaned.length} orphaned live message(s) from previous instance`);

  for (const row of orphaned) {
    const backend = backends.find((b) => b.name === row.backend);
    if (!backend) {
      console.warn(`[Notifier] No backend '${row.backend}' available to close orphaned message for space ${row.space_id}`);
      await deleteLiveMessage(row.space_id);
      continue;
    }

    const durationMs = Date.now() - row.started_at;
    try {
      await backend.notifySpaceInactive({
        messageId: row.message_id,
        spaceId: row.space_id,
        username: row.username,
        joinUrl: row.join_url,
        durationMs,
      });
      console.log(`[Notifier] Closed orphaned LIVE message for space ${row.space_id}`);
    } catch (error) {
      console.error(`[Notifier] Error closing orphaned message for ${row.space_id}:`, error);
    }

    await deleteLiveMessage(row.space_id);
  }
}

/**
 * Notify that a space became active (first user joined).
 * Stores the returned message ID for later updates (in-memory + DB).
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
        const startedAt = Date.now();
        console.log(`[Notifier] Live message posted for ${spaceId}`);
        
        liveMessages.set(spaceId, {
          messageId,
          username,
          joinUrl: notification.joinUrl,
          startedAt,
          backend,
        });

        // Persist to DB for crash recovery
        await saveLiveMessage({
          space_id: spaceId,
          message_id: messageId,
          username,
          join_url: notification.joinUrl,
          started_at: startedAt,
          backend: backend.name,
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

  // Remove from DB
  await deleteLiveMessage(spaceId);
}

/**
 * Post a threaded reply when a user joins an already-active space.
 * (The first joiner's name is already in the live message itself.)
 */
export async function notifyUserJoined(spaceId: string, username: string): Promise<void> {
  const live = liveMessages.get(spaceId);
  if (!live) return;
  
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
  
  if (live.backend instanceof SlackBackend) {
    await live.backend.postThreadReply(live.messageId, `🚪 *${username}* left`);
  }
}

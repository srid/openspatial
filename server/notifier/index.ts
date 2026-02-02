/**
 * Notifier orchestration - manages notification backends and state.
 */
import type { NotificationBackend, NotifierConfig, SpaceNotification } from './types.js';
import { createSlackBackendFromEnv } from './slack.js';

/** Tracks notification timestamps for cooldown */
const lastNotificationTime = new Map<string, number>();
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
  const lastTime = lastNotificationTime.get(spaceId);
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
      await backend.notifySpaceActive(notification);
      lastNotificationTime.set(spaceId, Date.now());
    } catch (error) {
      console.error(`[Notifier] Error in ${backend.name} backend:`, error);
    }
  }
}

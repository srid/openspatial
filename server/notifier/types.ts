/**
 * Generic notification backend interface.
 * Allows for multiple notification backends (Slack, Discord, email, etc.)
 */

export interface SpaceNotification {
  spaceId: string;
  username: string;
  joinUrl: string;
}

/**
 * Backend-agnostic notification interface.
 * Each backend (Slack, Discord, etc.) implements this.
 */
export interface NotificationBackend {
  /** Backend name for logging */
  readonly name: string;
  
  /**
   * Notify that a space became active.
   * @returns A message identifier for threading replies (backend-specific), or null if not supported.
   */
  notifySpaceActive(notification: SpaceNotification): Promise<string | null>;
  
  /**
   * Notify that a space became empty (as a reply to the original message).
   * @param spaceId The space that became empty
   * @param originalMessageId The identifier returned by notifySpaceActive() for threading
   */
  notifySpaceEmpty(spaceId: string, originalMessageId: string): Promise<void>;
}

/**
 * Configuration for the notifier system.
 */
export interface NotifierConfig {
  /** Registered notification backends */
  backends: NotificationBackend[];
  
  /** Cooldown in milliseconds between notifications for the same space */
  cooldownMs: number;
  
  /** Base URL for generating join links (e.g., https://spatial.srid.ca) */
  baseUrl: string;
  
  /**
   * List of space IDs to notify for. Null means notify for all spaces.
   */
  allowedSpaces: string[] | null;
  
  /**
   * Map of spaceId to backend-specific destination.
   * For Slack: webhook URL. For Discord: webhook URL. For email: address.
   * If not specified for a space, uses the backend's default destination.
   */
  spaceDestinationMap?: Record<string, string>;
}

/**
 * Generic notification backend interface.
 * Allows for multiple notification backends (Slack, Discord, email, etc.)
 */

export interface SpaceNotification {
  spaceId: string;
  username: string;
  joinUrl: string;
}

export interface SpaceInactiveNotification {
  /** Backend-specific message identifier (e.g., Slack message ts) */
  messageId: string;
  spaceId: string;
  /** How long the space was active, in milliseconds */
  durationMs: number;
}

/**
 * Backend-agnostic notification interface.
 * Each backend (Slack, Discord, etc.) implements this.
 */
export interface NotificationBackend {
  /** Backend name for logging */
  readonly name: string;
  
  /**
   * Notify that a space became active (first user joined).
   * @returns A backend-specific message identifier for later updates, or null on failure.
   */
  notifySpaceActive(notification: SpaceNotification): Promise<string | null>;

  /**
   * Update the live message to indicate the space is no longer active.
   * Called when the last user leaves.
   */
  notifySpaceInactive(notification: SpaceInactiveNotification): Promise<void>;
}

/**
 * Configuration for the notifier system.
 */
export interface NotifierConfig {
  /** Registered notification backends */
  backends: NotificationBackend[];
  
  /** Base URL for generating join links (e.g., https://spatial.srid.ca) */
  baseUrl: string;

  /**
   * List of space IDs to notify for. Null means notify for all spaces.
   */
  allowedSpaces: string[] | null;
}

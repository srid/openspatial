/**
 * Centralized server configuration.
 * All env vars are read in one place and passed through via typed config objects.
 */

export interface ServerConfig {
  port: number;
  https: boolean;
  dataDir: string;
  autoCreateSpaces: boolean;
  /** Grace period (ms) before finalizing a disconnect. Set to 0 in dev/E2E. */
  disconnectGraceMs: number;
  slack: SlackConfig;
  turn: TurnConfig;
}

export interface SlackConfig {
  botToken: string | null;
  channelId: string | null;
  baseUrl: string;
  /** Allow-list of space IDs. Null means notify for all spaces. */
  spaces: string[] | null;
}

export interface TurnConfig {
  host: string | null;
  secret: string | null;
  port: number;
}

/**
 * Read all server configuration from environment variables.
 * Used by the standalone production server.
 */
export function configFromEnv(): ServerConfig {
  const spacesEnv = process.env.SLACK_SPACES;

  return {
    port: Number(process.env.PORT) || 3000,
    https: process.env.HTTPS !== '0' && process.env.HTTPS !== 'false',
    dataDir: process.env.DATA_DIR || './data',
    autoCreateSpaces: process.env.AUTO_CREATE_SPACES === 'true',
    disconnectGraceMs: parseInt(process.env.DISCONNECT_GRACE_MS || '15000', 10),
    slack: {
      botToken: process.env.SLACK_BOT_TOKEN || null,
      channelId: process.env.SLACK_CHANNEL_ID || null,
      baseUrl: process.env.SLACK_BASE_URL || process.env.BASE_URL || '',
      spaces: spacesEnv ? spacesEnv.split(',').map(s => s.trim()) : null,
    },
    turn: {
      host: process.env.TURN_HOST || null,
      secret: process.env.TURN_SECRET || null,
      port: Number(process.env.TURN_PORT) || 3478,
    },
  };
}

/**
 * Default configuration for dev/E2E environments.
 * No grace period, auto-create spaces, no external services.
 */
export function devConfig(): ServerConfig {
  return {
    port: 5173,
    https: true,
    dataDir: './data',
    autoCreateSpaces: true,
    disconnectGraceMs: 0,
    slack: {
      botToken: null,
      channelId: null,
      baseUrl: '',
      spaces: null,
    },
    turn: {
      host: null,
      secret: null,
      port: 3478,
    },
  };
}

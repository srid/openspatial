import { createHmac } from 'crypto';

export interface TurnCredentials {
  username: string;
  credential: string;
}

export interface IceServer {
  urls: string | string[];
  username?: string;
  credential?: string;
}

/**
 * Get TURN configuration from environment variables.
 * Returns null if TURN is not configured.
 */
export function getTurnConfig(): { host: string; port: number; secret: string } | null {
  const host = process.env.TURN_HOST;
  const secret = process.env.TURN_SECRET;
  
  if (!host || !secret) {
    return null;
  }
  
  return {
    host,
    secret,
    port: Number(process.env.TURN_PORT) || 3478,
  };
}

/**
 * Generate time-limited TURN credentials using HMAC-SHA1.
 * This follows the coturn "use-auth-secret" mechanism.
 * 
 * @param secret - Shared secret between server and coturn
 * @param ttlSeconds - Credential validity duration (default: 1 hour)
 * @returns Username and credential for TURN authentication
 */
export function generateTurnCredentials(secret: string, ttlSeconds = 3600): TurnCredentials {
  // Username format: "timestamp:random" where timestamp is expiry time
  const timestamp = Math.floor(Date.now() / 1000) + ttlSeconds;
  const username = `${timestamp}:openspatial`;
  
  // Credential is HMAC-SHA1(secret, username)
  const hmac = createHmac('sha1', secret);
  hmac.update(username);
  const credential = hmac.digest('base64');
  
  return { username, credential };
}

/**
 * Get the full list of ICE servers including STUN and optionally TURN.
 */
export function getIceServers(): IceServer[] {
  const servers: IceServer[] = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ];
  
  const turnConfig = getTurnConfig();
  if (turnConfig) {
    const { username, credential } = generateTurnCredentials(turnConfig.secret);
    servers.push({
      urls: [
        `turn:${turnConfig.host}:${turnConfig.port}?transport=udp`,
        `turn:${turnConfig.host}:${turnConfig.port}?transport=tcp`,
      ],
      username,
      credential,
    });
  }
  
  return servers;
}

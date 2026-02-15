import { createHmac } from 'crypto';
import type { TurnConfig } from './config.js';

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
export function getIceServers(turn: TurnConfig): IceServer[] {
  const servers: IceServer[] = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ];
  
  if (turn.host && turn.secret) {
    const { username, credential } = generateTurnCredentials(turn.secret);
    servers.push({
      urls: [
        `turn:${turn.host}:${turn.port}?transport=udp`,
        `turn:${turn.host}:${turn.port}?transport=tcp`,
      ],
      username,
      credential,
    });
  }
  
  return servers;
}

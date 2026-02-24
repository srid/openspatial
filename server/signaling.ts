import { v4 as uuidv4 } from 'uuid';
import type { Server, Socket } from 'socket.io';
import * as Y from 'yjs';
// @ts-expect-error - y-websocket utils has no types
import { docs } from 'y-websocket/bin/utils';
import { notifySpaceActive, notifySpaceInactive, notifyUserJoined, notifyUserLeft } from './notifier/index.js';
import type {
  JoinSpaceEvent,
  SignalEvent,
  ScreenShareStartedEvent,
  ScreenShareStoppedEvent,
  GetSpaceInfoEvent,
  StreamsAnnouncedEvent,
  PeerData,
  ScreenShareData,
  SpaceStateEvent,
  PeerJoinedEvent,
  ConnectedEvent,
  ScreenShareStartedBroadcast,
  ScreenShareStoppedBroadcast,
} from '../shared/types/events.js';
import { getSpace as getSpaceFromDb, recordSpaceEvent, getRecentActivity } from './db.js';

// ─── Two-Tier Identity Model ────────────────────────────────────────────
//
// The server separates TRANSPORT identity (ephemeral Peer ID, new per socket)
// from APPLICATION identity (username, stable across reconnections).
//
// Space membership is keyed by username. On reconnection, the Peer ID is
// rotated in-place — no leave/join notifications are fired.
//
// NOTE: This means two browser tabs with the same username in the same space
// will collide (last tab wins). This is acceptable behaviour.
// ─────────────────────────────────────────────────────────────────────────

/** A logical user session within a space (survives transport reconnection). */
interface UserSession {
  username: string;
  /** Ephemeral — rotates on every new socket connection. */
  currentPeerId: string;
  position: { x: number; y: number };
  isMuted: boolean;
  isVideoOff: boolean;
  isScreenSharing: boolean;
}

interface Space {
  /** Keyed by username (stable), NOT peerId (ephemeral). */
  users: Map<string, UserSession>;
  screenShares: Map<string, ScreenShareData>;
}

import type { ServerConfig } from './config.js';

interface PendingLeave {
  timeout: ReturnType<typeof setTimeout>;
  spaceId: string;
  username: string;
  /** The peerId at time of disconnect — used to detect stale timers. */
  peerId: string;
}
// Key: "spaceId:username"
const pendingLeaves = new Map<string, PendingLeave>();

/**
 * Clean up a peer from the CRDT document when they disconnect.
 * This handles cases like browser refresh where client-side cleanup doesn't run.
 */
function cleanupCRDTOnDisconnect(spaceId: string, peerId: string): void {
  const doc = docs.get(spaceId) as Y.Doc | undefined;
  if (doc) {
    const peers = doc.getMap('peers');
    if (peers.has(peerId)) {
      peers.delete(peerId);
      console.log(`[CRDT Cleanup] Removed peer ${peerId} from space ${spaceId}`);
    }
    // Also cleanup any screen shares owned by this peer
    const screenShares = doc.getMap('screenShares');
    for (const [shareId, value] of screenShares.entries()) {
      const share = value as { peerId: string };
      if (share.peerId === peerId) {
        screenShares.delete(shareId);
        console.log(`[CRDT Cleanup] Removed screen share ${shareId} from space ${spaceId}`);
      }
    }
    // Note: Text notes are NOT cleaned up on disconnect - they are persisted and shared
  }
}

const SPACE_CENTER = 2000;
const MIN_SPAWN_DISTANCE = 150;
const SPAWN_RING_RADIUS = 200;

/**
 * Find a spawn position for a new user.
 * - First user spawns at center (2000, 2000).
 * - Subsequent users spawn near the largest group of existing peers,
 *   with guaranteed minimum separation of 150px from all existing peers.
 *
 * Includes disconnected-but-in-grace-period users to avoid spawning on top
 * of someone who may reconnect.
 */
function findSpawnPosition(space: Space): { x: number; y: number } {
  const existingPositions = Array.from(space.users.values()).map(u => u.position);
  
  if (existingPositions.length === 0) {
    return { x: SPACE_CENTER, y: SPACE_CENTER };
  }
  
  // Find the centroid of the largest cluster.
  // Simple approach: use the centroid of all existing peers (they're typically close together).
  const centroid = {
    x: existingPositions.reduce((sum, p) => sum + p.x, 0) / existingPositions.length,
    y: existingPositions.reduce((sum, p) => sum + p.y, 0) / existingPositions.length,
  };
  
  // Try positions in expanding rings around the centroid
  const peerCount = existingPositions.length;
  for (let ring = 1; ring <= 10; ring++) {
    const radius = SPAWN_RING_RADIUS * ring;
    // Place candidates evenly around the ring, offset by peer count to vary placement
    const candidates = 8 * ring;
    for (let i = 0; i < candidates; i++) {
      const angle = (2 * Math.PI * i) / candidates + (peerCount * 0.7);
      const candidate = {
        x: Math.round(centroid.x + radius * Math.cos(angle)),
        y: Math.round(centroid.y + radius * Math.sin(angle)),
      };
      
      // Clamp to space bounds (0–4000)
      candidate.x = Math.max(100, Math.min(3900, candidate.x));
      candidate.y = Math.max(100, Math.min(3900, candidate.y));
      
      // Check minimum distance from all existing peers
      const tooClose = existingPositions.some(p => {
        const dx = p.x - candidate.x;
        const dy = p.y - candidate.y;
        return Math.sqrt(dx * dx + dy * dy) < MIN_SPAWN_DISTANCE;
      });
      
      if (!tooClose) {
        return candidate;
      }
    }
  }
  
  // Fallback: deterministic offset from center (should never reach here with < 800 users)
  return {
    x: SPACE_CENTER + (peerCount % 20) * MIN_SPAWN_DISTANCE,
    y: SPACE_CENTER + Math.floor(peerCount / 20) * MIN_SPAWN_DISTANCE,
  };
}

/**
 * Attach Socket.io signaling handlers to a Socket.io server instance.
 * Shared between Vite plugin (dev) and standalone server (prod).
 */
export function attachSignaling(io: Server, config: ServerConfig): void {
  const disconnectGraceMs = config.disconnectGraceMs;
  console.log(`[Signaling] Disconnect grace period: ${disconnectGraceMs}ms`);

  // Space state management
  const spaces = new Map<string, Space>();
  // Map peerId -> socketId for direct signaling
  const peerSockets = new Map<string, string>();

  function getSpace(spaceId: string): Space {
    if (!spaces.has(spaceId)) {
      spaces.set(spaceId, {
        users: new Map(),
        screenShares: new Map(),
      });
    }
    return spaces.get(spaceId)!;
  }

  /**
   * Build a SpaceStateEvent from the user-keyed map.
   * Excludes users who are disconnected during grace period (no valid socket).
   * Keys are peerIds (ephemeral) because the client needs them for WebRTC routing.
   */
  function buildSpaceState(space: Space, spaceId: string): SpaceStateEvent {
    const peers: Record<string, PeerData> = {};
    for (const [username, user] of space.users) {
      // Skip users who are in the grace period (disconnected, awaiting reconnect)
      if (pendingLeaves.has(`${spaceId}:${username}`)) continue;

      peers[user.currentPeerId] = {
        username: user.username,
        position: user.position,
        isMuted: user.isMuted,
        isVideoOff: user.isVideoOff,
        isScreenSharing: user.isScreenSharing,
      };
    }
    return { peers };
  }

  /**
   * Count connected (non-grace-period) users in a space.
   */
  function connectedUserCount(space: Space, spaceId: string): number {
    let count = 0;
    for (const [username] of space.users) {
      if (!pendingLeaves.has(`${spaceId}:${username}`)) count++;
    }
    return count;
  }

  io.on('connection', (socket: Socket) => {
    const peerId = uuidv4();
    let currentSpace: string | null = null;
    let currentUsername: string | null = null;

    peerSockets.set(peerId, socket.id);

    // Query space info without joining (for pre-join preview)
    socket.on('get-space-info', async ({ spaceId }: GetSpaceInfoEvent) => {
      // Check if space exists in database (production) or in-memory (dev auto-create mode)
      const dbSpace = await getSpaceFromDb(spaceId);
      const memorySpace = spaces.get(spaceId);
      const exists = dbSpace !== null || config.autoCreateSpaces;
      
      if (memorySpace) {
        // Only show currently-connected participants
        const participants = Array.from(memorySpace.users.values())
          .filter(u => !pendingLeaves.has(`${spaceId}:${u.username}`))
          .map(u => u.username);
        socket.emit('space-info', { spaceId, exists, participants });
      } else {
        socket.emit('space-info', { spaceId, exists, participants: [] });
      }
    });

    socket.on('join-space', ({ spaceId, username }: JoinSpaceEvent) => {
      currentSpace = spaceId;
      currentUsername = username;
      socket.join(spaceId);

      // Cancel any pending leave for this user in this space
      const pendingKey = `${spaceId}:${username}`;
      const pendingLeave = pendingLeaves.get(pendingKey);
      if (pendingLeave) {
        clearTimeout(pendingLeave.timeout);
        pendingLeaves.delete(pendingKey);
      }

      const space = getSpace(spaceId);
      const existingUser = space.users.get(username);

      if (existingUser) {
        // ─── RECONNECTION: Peer ID rotation ─────────────────────────
        // The user already exists in this space. This is a transport-level
        // reconnection, NOT a new join. Rotate the peerId silently.
        const oldPeerId = existingUser.currentPeerId;
        peerSockets.delete(oldPeerId);

        existingUser.currentPeerId = peerId;
        peerSockets.set(peerId, socket.id);

        // Clean up stale CRDT entry for old peerId
        cleanupCRDTOnDisconnect(spaceId, oldPeerId);

        const connectedEvent: ConnectedEvent = { peerId };
        socket.emit('connected', connectedEvent);

        const spaceState = buildSpaceState(space, spaceId);
        socket.emit('space-state', spaceState);

        // Broadcast peer-joined with NEW peerId so other clients create fresh WebRTC connections.
        // (They already received peer-left for the OLD peerId on disconnect.)
        const peerJoined: PeerJoinedEvent = { peerId, username, position: existingUser.position };
        socket.to(spaceId).emit('peer-joined', peerJoined);

        console.log(`[Signaling] ${username} reconnected to ${spaceId} (peer ID rotated: ${oldPeerId.slice(0, 8)}… → ${peerId.slice(0, 8)}…)`);

        // NO recordSpaceEvent, NO notification — the user never left.
        // Push current activity so the reconnected client's panel is up-to-date.
        getRecentActivity(spaceId).then((events) => {
          socket.emit('space-activity', { spaceId, events });
        });
      } else {
        // ─── NEW JOIN ────────────────────────────────────────────────
        const wasEmpty = space.users.size === 0;
        const position = findSpawnPosition(space);

        space.users.set(username, {
          username,
          currentPeerId: peerId,
          position,
          isMuted: false,
          isVideoOff: false,
          isScreenSharing: false,
        });

        const connectedEvent: ConnectedEvent = { peerId };
        socket.emit('connected', connectedEvent);

        const spaceState = buildSpaceState(space, spaceId);
        socket.emit('space-state', spaceState);

        const peerJoined: PeerJoinedEvent = { peerId, username, position };
        socket.to(spaceId).emit('peer-joined', peerJoined);

        console.log(`[Signaling] ${username} joined space ${spaceId} (${connectedUserCount(space, spaceId)} connected users)`);

        // Record space event and notify
        if (wasEmpty) {
          recordSpaceEvent(spaceId, 'join_first', username);
          notifySpaceActive(spaceId, username);
        } else {
          recordSpaceEvent(spaceId, 'join', username);
          notifyUserJoined(spaceId, username);
        }
        
        // Push recent activity to ALL users in the space
        getRecentActivity(spaceId).then((events) => {
          io.to(spaceId).emit('space-activity', { spaceId, events });
        });
      }
    });

    // Route signals to specific peer, not broadcast
    socket.on('signal', (data: SignalEvent) => {
      const { to, from, signal } = data;
      const targetSocketId = peerSockets.get(to);
      if (targetSocketId) {
        io.to(targetSocketId).emit('signal', data);
      } else {
        console.warn(`[Signaling] Target peer ${to} not found for signal`);
      }
    });

    // Position updates: not for state sync (CRDT handles that) but so
    // findSpawnPosition uses live positions instead of stale join-time values.
    socket.on('position-update', (data: { x: number; y: number }) => {
      if (!currentSpace || !currentUsername) return;
      const space = spaces.get(currentSpace);
      const user = space?.users.get(currentUsername);
      if (user) {
        user.position = { x: data.x, y: data.y };
      }
    });

    socket.on('screen-share-started', ({ peerId: pid, shareId }: ScreenShareStartedEvent) => {
      if (!currentSpace || !currentUsername) return;
      const space = spaces.get(currentSpace);
      const user = space?.users.get(currentUsername);
      if (user) {
        user.isScreenSharing = true;
        // Only track shareId -> peerId/username mapping for WebRTC routing
        // Position and size are managed by CRDT
        const shareData: ScreenShareData = {
          peerId: pid,
          username: currentUsername,
        };
        space?.screenShares.set(shareId, shareData);
        
        const broadcast: ScreenShareStartedBroadcast = {
          peerId: pid,
          shareId,
          username: currentUsername,
        };
        socket.to(currentSpace).emit('screen-share-started', broadcast);
        console.log(`[Signaling] ${currentUsername} started screen share in ${currentSpace}`);
      }
    });
    
    // Forward stream announcements to other peers in the space
    socket.on('streams-announced', (data: StreamsAnnouncedEvent) => {
      if (!currentSpace) return;
      socket.to(currentSpace).emit('streams-announced', data);
    });

    socket.on('screen-share-stopped', ({ peerId: pid, shareId }: ScreenShareStoppedEvent) => {
      if (!currentSpace || !currentUsername) return;
      const space = spaces.get(currentSpace);
      const user = space?.users.get(currentUsername);
      if (user) {
        user.isScreenSharing = false;
        space?.screenShares.delete(shareId);
        
        const broadcast: ScreenShareStoppedBroadcast = { peerId: pid, shareId };
        socket.to(currentSpace).emit('screen-share-stopped', broadcast);
        console.log(`[Signaling] ${currentUsername} stopped screen share in ${currentSpace}`);
      }
    });

    socket.on('disconnect', (reason: string) => {
      peerSockets.delete(peerId);

      if (currentSpace && currentUsername) {
        const space = spaces.get(currentSpace);
        if (space) {
          // Remove screen shares owned by this peer
          for (const [shareId, share] of space.screenShares) {
            if (share.peerId === peerId) {
              space.screenShares.delete(shareId);
            }
          }
          
          // Clean up CRDT - remove peer and their screen shares from Yjs document
          cleanupCRDTOnDisconnect(currentSpace, peerId);
          
          // Broadcast peer-left immediately so the UI stays responsive
          socket.to(currentSpace).emit('peer-left', { peerId });
          console.log(`[Signaling] ${currentUsername} disconnected from ${currentSpace} (reason: ${reason})`);

          const username = currentUsername;
          const spaceId = currentSpace;
          const isIntentionalLeave = reason === 'client namespace disconnect';

          if (isIntentionalLeave) {
            // ─── INTENTIONAL LEAVE (user clicked Leave) ──────────────
            // Remove immediately, fire notifications now.
            space.users.delete(username);

            if (space.users.size === 0) {
              recordSpaceEvent(spaceId, 'leave_last', username);
              notifySpaceInactive(spaceId);
              spaces.delete(spaceId);
              console.log(`[Signaling] Space ${spaceId} deleted (empty after intentional leave)`);
            } else {
              recordSpaceEvent(spaceId, 'leave', username);
              notifyUserLeft(spaceId, username);
              // Push updated activity to remaining peers
              getRecentActivity(spaceId).then((events) => {
                io.to(spaceId).emit('space-activity', { spaceId, events });
              });
            }
          } else {
            // ─── NETWORK DROP (transport close, ping timeout, etc.) ──
            // Keep user in space.users. Defer removal behind grace period
            // to absorb transient reconnections.
            const pendingKey = `${spaceId}:${username}`;
            
            // Cancel any existing pending leave (shouldn't happen, but be safe)
            const existing = pendingLeaves.get(pendingKey);
            if (existing) {
              clearTimeout(existing.timeout);
            }
            
            const timeout = setTimeout(() => {
              pendingLeaves.delete(pendingKey);
              
              const currentSpaceState = spaces.get(spaceId);
              if (!currentSpaceState) return;

              const user = currentSpaceState.users.get(username);
              if (!user) return; // Already removed (shouldn't happen)

              // Check if the user reconnected — if so, their peerId has rotated
              // and this timer is stale.
              if (user.currentPeerId !== peerId) {
                console.log(`[Signaling] Grace period expired for ${username} in ${spaceId}, but they already reconnected — ignoring`);
                return;
              }

              // User didn't reconnect within grace period — truly remove them.
              currentSpaceState.users.delete(username);

              if (currentSpaceState.users.size === 0) {
                recordSpaceEvent(spaceId, 'leave_last', username);
                notifySpaceInactive(spaceId);
                spaces.delete(spaceId);
                console.log(`[Signaling] Space ${spaceId} deleted (empty after grace period)`);
              } else {
                recordSpaceEvent(spaceId, 'leave', username);
                notifyUserLeft(spaceId, username);
                // Push updated activity to remaining peers
                getRecentActivity(spaceId).then((events) => {
                  io.to(spaceId).emit('space-activity', { spaceId, events });
                });
              }
            }, disconnectGraceMs);
            
            pendingLeaves.set(pendingKey, { timeout, spaceId, username, peerId });
          }
        }
      }
    });
  });
}

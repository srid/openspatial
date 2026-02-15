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
  PeerData,
  ScreenShareData,
  SpaceStateEvent,
  PeerJoinedEvent,
  ConnectedEvent,
  ScreenShareStartedBroadcast,
  ScreenShareStoppedBroadcast,
} from '../shared/types/events.js';
import { getSpace as getSpaceFromDb, recordSpaceEvent, getRecentActivity } from './db.js';

interface Space {
  peers: Map<string, PeerData>;
  screenShares: Map<string, ScreenShareData>;
}

// Grace period for disconnect: delay leave notifications to absorb reconnects
const DISCONNECT_GRACE_MS = parseInt(process.env.DISCONNECT_GRACE_MS || '15000', 10);

interface PendingLeave {
  timeout: ReturnType<typeof setTimeout>;
  spaceId: string;
  username: string;
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

/**
 * Attach Socket.io signaling handlers to a Socket.io server instance.
 * Shared between Vite plugin (dev) and standalone server (prod).
 */
export function attachSignaling(io: Server): void {
  // Space state management
  const spaces = new Map<string, Space>();
  // Map peerId -> socketId for direct signaling
  const peerSockets = new Map<string, string>();

  function getSpace(spaceId: string): Space {
    if (!spaces.has(spaceId)) {
      spaces.set(spaceId, {
        peers: new Map(),
        screenShares: new Map(),
      });
    }
    return spaces.get(spaceId)!;
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
      const exists = dbSpace !== null || process.env.AUTO_CREATE_SPACES === 'true';
      
      if (memorySpace) {
        const participants = Array.from(memorySpace.peers.values()).map(p => p.username);
        socket.emit('space-info', { spaceId, exists, participants });
      } else {
        socket.emit('space-info', { spaceId, exists, participants: [] });
      }
    });

    socket.on('join-space', ({ spaceId, username }: JoinSpaceEvent) => {
      currentSpace = spaceId;
      currentUsername = username;
      socket.join(spaceId);

      // Cancel any pending leave for this user in this space (reconnect within grace period)
      const pendingKey = `${spaceId}:${username}`;
      const pendingLeave = pendingLeaves.get(pendingKey);
      if (pendingLeave) {
        clearTimeout(pendingLeave.timeout);
        pendingLeaves.delete(pendingKey);
        console.log(`[Signaling] ${username} reconnected to ${spaceId} within grace period — leave cancelled`);
      }

      const space = getSpace(spaceId);
      const wasEmpty = space.peers.size === 0;
      const position = {
        x: 1800 + Math.random() * 400,
        y: 1800 + Math.random() * 400,
      };

      const peerData: PeerData = {
        username,
        position,
        isMuted: false,
        isVideoOff: false,
        isScreenSharing: false,
      };
      space.peers.set(peerId, peerData);

      const connectedEvent: ConnectedEvent = { peerId };
      socket.emit('connected', connectedEvent);

      const spaceState: SpaceStateEvent = {
        peers: Object.fromEntries(space.peers),
        // Screen shares are managed by CRDT, not sent here
      };
      socket.emit('space-state', spaceState);

      const peerJoined: PeerJoinedEvent = { peerId, username, position };
      socket.to(spaceId).emit('peer-joined', peerJoined);

      console.log(`[Signaling] ${username} joined space ${spaceId} (${space.peers.size} peers)`);
      // Record space event and notify
      // If there was a pending leave that we just cancelled, treat this as a regular join
      // (the space never truly went empty from the notification perspective)
      if (wasEmpty && !pendingLeave) {
        recordSpaceEvent(spaceId, 'join_first', username);
        notifySpaceActive(spaceId, username);
      } else {
        recordSpaceEvent(spaceId, 'join', username);
        if (!pendingLeave) {
          notifyUserJoined(spaceId, username);
        }
      }
      
      // Push recent activity to ALL users in the space (including existing users)
      getRecentActivity(spaceId).then((events) => {
        io.to(spaceId).emit('space-activity', { spaceId, events });
      });
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

    // Note: The following handlers have been removed as state sync is now managed by Yjs CRDT:
    // - position-update
    // - screen-share-position-update
    // - screen-share-resize-update
    // - media-state-update
    // - status-update

    socket.on('screen-share-started', ({ peerId: pid, shareId }: ScreenShareStartedEvent) => {
      if (!currentSpace) return;
      const space = spaces.get(currentSpace);
      const peer = space?.peers.get(pid);
      if (peer && currentUsername) {
        peer.isScreenSharing = true;
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

    socket.on('screen-share-stopped', ({ peerId: pid, shareId }: ScreenShareStoppedEvent) => {
      if (!currentSpace) return;
      const space = spaces.get(currentSpace);
      const peer = space?.peers.get(pid);
      if (peer) {
        peer.isScreenSharing = false;
        space?.screenShares.delete(shareId);
        
        const broadcast: ScreenShareStoppedBroadcast = { peerId: pid, shareId };
        socket.to(currentSpace).emit('screen-share-stopped', broadcast);
        console.log(`[Signaling] ${currentUsername} stopped screen share in ${currentSpace}`);
      }
    });

    socket.on('disconnect', () => {
      peerSockets.delete(peerId);

      if (currentSpace) {
        const space = spaces.get(currentSpace);
        if (space) {
          space.peers.delete(peerId);
          // Remove all screen shares from this peer
          for (const [shareId, share] of space.screenShares) {
            if (share.peerId === peerId) {
              space.screenShares.delete(shareId);
            }
          }
          
          // Clean up CRDT - remove peer and their screen shares from Yjs document
          cleanupCRDTOnDisconnect(currentSpace, peerId);
          
          // Broadcast peer-left immediately so the UI stays responsive
          socket.to(currentSpace).emit('peer-left', { peerId });
          console.log(`[Signaling] ${currentUsername} left space ${currentSpace} (${space.peers.size} peers)`);
          
          // Defer notification side-effects behind a grace period
          // to absorb transient connection drops (reconnects cancel the pending leave)
          const username = currentUsername || 'unknown';
          const spaceId = currentSpace;
          const pendingKey = `${spaceId}:${username}`;
          
          // Cancel any existing pending leave for this user (shouldn't happen, but be safe)
          const existing = pendingLeaves.get(pendingKey);
          if (existing) {
            clearTimeout(existing.timeout);
          }
          
          const timeout = setTimeout(() => {
            pendingLeaves.delete(pendingKey);
            
            // Re-check the space state — another user may have joined during the grace period
            const currentSpaceState = spaces.get(spaceId);
            if (!currentSpaceState || currentSpaceState.peers.size === 0) {
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
          }, DISCONNECT_GRACE_MS);
          
          pendingLeaves.set(pendingKey, { timeout, spaceId, username });
        }
      }
    });
  });
}

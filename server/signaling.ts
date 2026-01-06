import { v4 as uuidv4 } from 'uuid';
import type { Server, Socket } from 'socket.io';
import type {
  JoinSpaceEvent,
  SignalEvent,
  PositionUpdateEvent,
  MediaStateUpdateEvent,
  ScreenShareStartedEvent,
  ScreenShareStoppedEvent,
  ScreenSharePositionUpdateEvent,
  ScreenShareResizeUpdateEvent,
  PeerData,
  ScreenShareData,
  SpaceStateEvent,
  PeerJoinedEvent,
  ConnectedEvent,
  ScreenShareStartedBroadcast,
  ScreenShareStoppedBroadcast,
} from '../shared/types/events.js';
import type { SessionRecord, GetHistoryEvent, HistoryEvent } from '../shared/types/session.js';
import { SessionStorage } from './storage.js';

interface Space {
  peers: Map<string, PeerData>;
  screenShares: Map<string, ScreenShareData>;
  currentSession: SessionRecord | null;
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
        currentSession: null,
      });
    }
    return spaces.get(spaceId)!;
  }

  io.on('connection', (socket: Socket) => {
    const peerId = uuidv4();
    let currentSpace: string | null = null;
    let currentUsername: string | null = null;

    peerSockets.set(peerId, socket.id);
    console.log(`[Signaling] Peer connected: ${peerId}`);

    socket.on('get-history', async ({ spaceId }: GetHistoryEvent) => {
      const sessions = await SessionStorage.getSessions(spaceId);
      const historyEvent: HistoryEvent = { spaceId, sessions };
      socket.emit('history', historyEvent);
    });

    socket.on('join-space', ({ spaceId, username }: JoinSpaceEvent) => {
      currentSpace = spaceId;
      currentUsername = username;
      socket.join(spaceId);

      const space = getSpace(spaceId);

      // Start session if this is the first peer
      if (space.peers.size === 0) {
        if (!space.currentSession) {
            space.currentSession = {
                sessionId: uuidv4(),
                spaceId: spaceId,
                startTime: Date.now(),
                endTime: null,
                visits: [],
            };
            console.log(`[Signaling] Started new session ${space.currentSession.sessionId} for space ${spaceId}`);
        }
      }

      // Add visit record
      if (space.currentSession) {
          space.currentSession.visits.push({
              username: username,
              joinTime: Date.now(),
              leaveTime: null
          });
      }

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
        screenShares: Object.fromEntries(space.screenShares),
      };
      socket.emit('space-state', spaceState);

      const peerJoined: PeerJoinedEvent = { peerId, username, position };
      socket.to(spaceId).emit('peer-joined', peerJoined);

      console.log(`[Signaling] ${username} joined space ${spaceId} (${space.peers.size} peers)`);
    });

    // Route signals to specific peer, not broadcast
    socket.on('signal', (data: SignalEvent) => {
      const { to, from, signal } = data;
      const targetSocketId = peerSockets.get(to);
      if (targetSocketId) {
        io.to(targetSocketId).emit('signal', data);
        console.log(`[Signaling] Signal ${signal.type} from ${from} to ${to}`);
      } else {
        console.log(`[Signaling] Target peer ${to} not found for signal`);
      }
    });

    socket.on('position-update', ({ peerId: pid, x, y }: PositionUpdateEvent) => {
      if (!currentSpace) return;
      const space = spaces.get(currentSpace);
      const peer = space?.peers.get(pid);
      if (peer) {
        peer.position = { x, y };
        socket.to(currentSpace).emit('position-update', { peerId: pid, x, y });
      }
    });

    socket.on('screen-share-position-update', ({ shareId, x, y }: ScreenSharePositionUpdateEvent) => {
      if (!currentSpace) return;
      const space = spaces.get(currentSpace);
      const share = space?.screenShares.get(shareId);
      if (share) {
        share.x = x;
        share.y = y;
      }
      socket.to(currentSpace).emit('screen-share-position-update', { shareId, x, y });
    });

    socket.on('screen-share-resize-update', ({ shareId, width, height }: ScreenShareResizeUpdateEvent) => {
      if (!currentSpace) return;
      socket.to(currentSpace).emit('screen-share-resize-update', { shareId, width, height });
    });

    socket.on('media-state-update', ({ peerId: pid, isMuted, isVideoOff }: MediaStateUpdateEvent) => {
      if (!currentSpace) return;
      const space = spaces.get(currentSpace);
      const peer = space?.peers.get(pid);
      if (peer) {
        peer.isMuted = isMuted;
        peer.isVideoOff = isVideoOff;
        socket.to(currentSpace).emit('media-state-update', { peerId: pid, isMuted, isVideoOff });
      }
    });

    socket.on('screen-share-started', ({ peerId: pid, shareId, x, y }: ScreenShareStartedEvent) => {
      if (!currentSpace) return;
      const space = spaces.get(currentSpace);
      const peer = space?.peers.get(pid);
      if (peer && currentUsername) {
        peer.isScreenSharing = true;
        const shareData: ScreenShareData = {
          peerId: pid,
          username: currentUsername,
          x: x || 0,
          y: y || 0,
        };
        space?.screenShares.set(shareId, shareData);
        
        const broadcast: ScreenShareStartedBroadcast = {
          peerId: pid,
          shareId,
          username: currentUsername,
        };
        socket.to(currentSpace).emit('screen-share-started', broadcast);
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
      }
    });

    socket.on('disconnect', () => {
      peerSockets.delete(peerId);

      if (currentSpace) {
        const space = spaces.get(currentSpace);
        if (space) {
          // Record leave time
          if (space.currentSession && currentUsername) {
              // Find the last visit for this user that hasn't ended (or just match by username and null leaveTime)
              // Since username isn't unique, this is imperfect but acceptable for this scope.
              // Better would be to track visit index in peerData or similar.
              // For now, we take the last visit with matching username and null leaveTime.
              for (let i = space.currentSession.visits.length - 1; i >= 0; i--) {
                  const visit = space.currentSession.visits[i];
                  if (visit.username === currentUsername && visit.leaveTime === null) {
                      visit.leaveTime = Date.now();
                      break;
                  }
              }
          }

          space.peers.delete(peerId);
          // Remove all screen shares from this peer
          for (const [shareId, share] of space.screenShares) {
            if (share.peerId === peerId) {
              space.screenShares.delete(shareId);
            }
          }
          socket.to(currentSpace).emit('peer-left', { peerId });
          console.log(`[Signaling] ${currentUsername} left space ${currentSpace} (${space.peers.size} peers)`);
          if (space.peers.size === 0) {
            // End session
            if (space.currentSession) {
                space.currentSession.endTime = Date.now();
                const sessionId = space.currentSession.sessionId;
                SessionStorage.saveSession(space.currentSession).then(() => {
                    console.log(`[Signaling] Session ${sessionId} ended and saved.`);
                }).catch(err => {
                    console.error('[Signaling] Failed to save session:', err);
                });
                space.currentSession = null;
            }
            spaces.delete(currentSpace);
            console.log(`[Signaling] Space ${currentSpace} deleted (empty)`);
          }
        }
      }
      console.log(`[Signaling] Peer disconnected: ${peerId}`);
    });
  });

  console.log('[Signaling] Socket.io signaling attached');
}

/**
 * Socket.io signaling handlers for WebRTC peer discovery.
 * State synchronization is now handled by Yjs CRDT (yjs-provider.ts).
 * This module handles only:
 * - Peer join/leave notifications (for WebRTC connection establishment)
 * - WebRTC signaling (offer/answer/candidate)
 * - Screen share start/stop signals (for WebRTC track coordination)
 * - Pre-join space info queries
 */

import { v4 as uuidv4 } from 'uuid';
import type { Server, Socket } from 'socket.io';
import type {
  JoinSpaceEvent,
  SignalEvent,
  ScreenShareStartedEvent,
  ScreenShareStoppedEvent,
  GetSpaceInfoEvent,
  PeerJoinedEvent,
  ConnectedEvent,
  ScreenShareStartedBroadcast,
  ScreenShareStoppedBroadcast,
} from '../shared/types/events.js';

interface SpaceInfo {
  peers: Map<string, { username: string; position: { x: number; y: number } }>;
}

/**
 * Attach Socket.io signaling handlers for WebRTC peer discovery.
 * State sync (position, media, status) is handled by Yjs CRDT.
 */
export function attachSignaling(io: Server): void {
  const spaces = new Map<string, SpaceInfo>();
  const peerSockets = new Map<string, string>();

  function getSpace(spaceId: string): SpaceInfo {
    if (!spaces.has(spaceId)) {
      spaces.set(spaceId, { peers: new Map() });
    }
    return spaces.get(spaceId)!;
  }

  io.on('connection', (socket: Socket) => {
    const peerId = uuidv4();
    let currentSpace: string | null = null;
    let currentUsername: string | null = null;

    peerSockets.set(peerId, socket.id);

    // Query space info without joining (for pre-join preview)
    socket.on('get-space-info', ({ spaceId }: GetSpaceInfoEvent) => {
      const space = spaces.get(spaceId);
      if (space) {
        const participants = Array.from(space.peers.values()).map(p => p.username);
        socket.emit('space-info', { spaceId, participants });
      } else {
        socket.emit('space-info', { spaceId, participants: [] });
      }
    });

    // Join space: assign peerId and notify other peers
    socket.on('join-space', ({ spaceId, username }: JoinSpaceEvent) => {
      currentSpace = spaceId;
      currentUsername = username;
      socket.join(spaceId);

      const space = getSpace(spaceId);
      const position = {
        x: 1800 + Math.random() * 400,
        y: 1800 + Math.random() * 400,
      };

      space.peers.set(peerId, { username, position });

      // Send connected event with assigned peerId
      const connectedEvent: ConnectedEvent = { peerId };
      socket.emit('connected', connectedEvent);

      // Notify existing peers about new peer (for WebRTC)
      const peerJoined: PeerJoinedEvent = { peerId, username, position };
      socket.to(spaceId).emit('peer-joined', peerJoined);

      console.log(`[Signaling] ${username} joined ${spaceId} (${space.peers.size} peers)`);
    });

    // WebRTC signaling: route offer/answer/candidate to specific peer
    socket.on('signal', (data: SignalEvent) => {
      const { to } = data;
      const targetSocketId = peerSockets.get(to);
      if (targetSocketId) {
        io.to(targetSocketId).emit('signal', data);
      } else {
        console.warn(`[Signaling] Target peer ${to} not found`);
      }
    });

    // Screen share started: notify peers for WebRTC track coordination
    socket.on('screen-share-started', ({ peerId: pid, shareId, x, y }: ScreenShareStartedEvent) => {
      if (!currentSpace || !currentUsername) return;

      const broadcast: ScreenShareStartedBroadcast = {
        peerId: pid,
        shareId,
        username: currentUsername,
      };
      socket.to(currentSpace).emit('screen-share-started', broadcast);
      console.log(`[Signaling] ${currentUsername} started screen share`);
    });

    // Screen share stopped: notify peers for WebRTC track cleanup
    socket.on('screen-share-stopped', ({ peerId: pid, shareId }: ScreenShareStoppedEvent) => {
      if (!currentSpace) return;

      const broadcast: ScreenShareStoppedBroadcast = { peerId: pid, shareId };
      socket.to(currentSpace).emit('screen-share-stopped', broadcast);
      console.log(`[Signaling] ${currentUsername} stopped screen share`);
    });

    // Disconnect: notify peers and cleanup
    socket.on('disconnect', () => {
      peerSockets.delete(peerId);

      if (currentSpace) {
        const space = spaces.get(currentSpace);
        if (space) {
          space.peers.delete(peerId);
          socket.to(currentSpace).emit('peer-left', { peerId });
          console.log(`[Signaling] ${currentUsername} left ${currentSpace} (${space.peers.size} peers)`);
          
          if (space.peers.size === 0) {
            spaces.delete(currentSpace);
            console.log(`[Signaling] Space ${currentSpace} deleted (empty)`);
          }
        }
      }
    });
  });
}

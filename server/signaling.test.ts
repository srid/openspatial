import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Server } from 'socket.io';
import { createServer } from 'http';
import { io as ioc, Socket } from 'socket.io-client';
import { AddressInfo } from 'net';
import { attachSignaling } from './signaling.js';

/**
 * Integration tests for the signaling server.
 * Tests the full Socket.io event flow without mocking.
 */

describe('Signaling Server', () => {
  let httpServer: ReturnType<typeof createServer>;
  let ioServer: Server;
  let clientSocket1: Socket;
  let clientSocket2: Socket;
  let serverUrl: string;

  beforeEach(async () => {
    httpServer = createServer();
    ioServer = new Server(httpServer);
    attachSignaling(ioServer);

    await new Promise<void>((resolve) => {
      httpServer.listen(0, () => {
        const address = httpServer.address() as AddressInfo;
        serverUrl = `http://localhost:${address.port}`;
        resolve();
      });
    });
  });

  afterEach(async () => {
    clientSocket1?.disconnect();
    clientSocket2?.disconnect();
    ioServer.close();
    await new Promise<void>((resolve) => {
      httpServer.close(() => resolve());
    });
  });

  function connectClient(): Promise<Socket> {
    return new Promise((resolve) => {
      const socket = ioc(serverUrl, {
        transports: ['websocket'],
      });
      socket.on('connect', () => resolve(socket));
    });
  }

  describe('connection flow', () => {
    it('assigns a unique peerId on connection', async () => {
      clientSocket1 = await connectClient();

      const connectedEvent = await new Promise<{ peerId: string }>((resolve) => {
        clientSocket1.on('connected', resolve);
        clientSocket1.emit('join-space', { spaceId: 'test-room', username: 'Alice' });
      });

      expect(connectedEvent.peerId).toBeDefined();
      expect(typeof connectedEvent.peerId).toBe('string');
    });

    it('provides space state on join', async () => {
      clientSocket1 = await connectClient();

      const spaceState = await new Promise<{ peers: Record<string, unknown> }>((resolve) => {
        clientSocket1.on('space-state', resolve);
        clientSocket1.emit('join-space', { spaceId: 'test-room', username: 'Alice' });
      });

      expect(spaceState.peers).toBeDefined();
      expect(Object.keys(spaceState.peers).length).toBe(1); // Self included
    });
  });

  describe('peer events', () => {
    it('broadcasts peer-joined to other peers', async () => {
      clientSocket1 = await connectClient();
      clientSocket2 = await connectClient();

      // First peer joins
      await new Promise<void>((resolve) => {
        clientSocket1.on('connected', () => resolve());
        clientSocket1.emit('join-space', { spaceId: 'shared-room', username: 'Alice' });
      });

      // Set up peer-joined listener before second peer joins
      const peerJoinedPromise = new Promise<{ peerId: string; username: string }>((resolve) => {
        clientSocket1.on('peer-joined', resolve);
      });

      // Second peer joins
      await new Promise<void>((resolve) => {
        clientSocket2.on('connected', () => resolve());
        clientSocket2.emit('join-space', { spaceId: 'shared-room', username: 'Bob' });
      });

      const peerJoined = await peerJoinedPromise;
      expect(peerJoined.username).toBe('Bob');
      expect(peerJoined.peerId).toBeDefined();
    });

    it('broadcasts peer-left when peer disconnects', async () => {
      clientSocket1 = await connectClient();
      clientSocket2 = await connectClient();

      // Both peers join
      await Promise.all([
        new Promise<void>((resolve) => {
          clientSocket1.on('connected', () => resolve());
          clientSocket1.emit('join-space', { spaceId: 'shared-room', username: 'Alice' });
        }),
        new Promise<void>((resolve) => {
          clientSocket2.on('connected', () => resolve());
          clientSocket2.emit('join-space', { spaceId: 'shared-room', username: 'Bob' });
        }),
      ]);

      const peerLeftPromise = new Promise<{ peerId: string }>((resolve) => {
        clientSocket1.on('peer-left', resolve);
      });

      clientSocket2.disconnect();

      const peerLeft = await peerLeftPromise;
      expect(peerLeft.peerId).toBeDefined();
    });
  });

  describe('position updates', () => {
    it('broadcasts position-update to other peers', async () => {
      clientSocket1 = await connectClient();
      clientSocket2 = await connectClient();

      // Both join
      let client1PeerId: string;
      await Promise.all([
        new Promise<void>((resolve) => {
          clientSocket1.on('connected', (data: { peerId: string }) => {
            client1PeerId = data.peerId;
            resolve();
          });
          clientSocket1.emit('join-space', { spaceId: 'shared-room', username: 'Alice' });
        }),
        new Promise<void>((resolve) => {
          clientSocket2.on('connected', () => resolve());
          clientSocket2.emit('join-space', { spaceId: 'shared-room', username: 'Bob' });
        }),
      ]);

      const positionUpdatePromise = new Promise<{ peerId: string; x: number; y: number }>((resolve) => {
        clientSocket2.on('position-update', resolve);
      });

      clientSocket1.emit('position-update', { peerId: client1PeerId!, x: 500, y: 600 });

      const positionUpdate = await positionUpdatePromise;
      expect(positionUpdate.x).toBe(500);
      expect(positionUpdate.y).toBe(600);
    });
  });

  describe('signal routing', () => {
    it('routes signal to specific target peer', async () => {
      clientSocket1 = await connectClient();
      clientSocket2 = await connectClient();

      // Both join and get peer IDs
      let client1PeerId: string;
      let client2PeerId: string;

      await Promise.all([
        new Promise<void>((resolve) => {
          clientSocket1.on('connected', (data: { peerId: string }) => {
            client1PeerId = data.peerId;
            resolve();
          });
          clientSocket1.emit('join-space', { spaceId: 'shared-room', username: 'Alice' });
        }),
        new Promise<void>((resolve) => {
          clientSocket2.on('connected', (data: { peerId: string }) => {
            client2PeerId = data.peerId;
            resolve();
          });
          clientSocket2.emit('join-space', { spaceId: 'shared-room', username: 'Bob' });
        }),
      ]);

      const signalPromise = new Promise<{ from: string; to: string; signal: { type: string } }>((resolve) => {
        clientSocket2.on('signal', resolve);
      });

      clientSocket1.emit('signal', {
        from: client1PeerId!,
        to: client2PeerId!,
        signal: { type: 'offer', sdp: { type: 'offer', sdp: 'test-sdp' } },
      });

      const signal = await signalPromise;
      expect(signal.from).toBe(client1PeerId);
      expect(signal.to).toBe(client2PeerId);
      expect(signal.signal.type).toBe('offer');
    });
  });
});

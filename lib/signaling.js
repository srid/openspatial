import { v4 as uuidv4 } from 'uuid';

/**
 * Attach Socket.io signaling handlers to a Socket.io server instance.
 * Shared between Vite plugin (dev) and standalone server (prod).
 */
export function attachSignaling(io) {
    // Space state management
    const spaces = new Map();
    // Map peerId -> socketId for direct signaling
    const peerSockets = new Map();

    function getSpace(spaceId) {
        if (!spaces.has(spaceId)) {
            spaces.set(spaceId, { peers: new Map() });
        }
        return spaces.get(spaceId);
    }

    io.on('connection', (socket) => {
        const peerId = uuidv4();
        let currentSpace = null;
        let currentUsername = null;

        peerSockets.set(peerId, socket.id);
        console.log(`[Signaling] Peer connected: ${peerId}`);

        socket.on('join-space', ({ spaceId, username }) => {
            currentSpace = spaceId;
            currentUsername = username;
            socket.join(spaceId);

            const space = getSpace(spaceId);
            const position = {
                x: 1800 + Math.random() * 400,
                y: 1800 + Math.random() * 400
            };

            space.peers.set(peerId, {
                username,
                position,
                isMuted: false,
                isVideoOff: false,
                isScreenSharing: false
            });

            socket.emit('connected', { peerId });
            socket.emit('space-state', { peers: Object.fromEntries(space.peers) });
            socket.to(spaceId).emit('peer-joined', { peerId, username, position });

            console.log(`[Signaling] ${username} joined space ${spaceId} (${space.peers.size} peers)`);
        });

        // Route signals to specific peer, not broadcast
        socket.on('signal', (data) => {
            const { to, from, signal } = data;
            const targetSocketId = peerSockets.get(to);
            if (targetSocketId) {
                io.to(targetSocketId).emit('signal', data);
                console.log(`[Signaling] Signal ${signal.type} from ${from} to ${to}`);
            } else {
                console.log(`[Signaling] Target peer ${to} not found for signal`);
            }
        });

        socket.on('position-update', ({ peerId: pid, x, y }) => {
            if (!currentSpace) return;
            const space = spaces.get(currentSpace);
            if (space?.peers.has(pid)) {
                space.peers.get(pid).position = { x, y };
                socket.to(currentSpace).emit('position-update', { peerId: pid, x, y });
            }
        });

        socket.on('screen-share-position-update', ({ peerId: pid, x, y }) => {
            if (!currentSpace) return;
            socket.to(currentSpace).emit('screen-share-position-update', { peerId: pid, x, y });
        });

        socket.on('media-state-update', ({ peerId: pid, isMuted, isVideoOff }) => {
            if (!currentSpace) return;
            const space = spaces.get(currentSpace);
            if (space?.peers.has(pid)) {
                space.peers.get(pid).isMuted = isMuted;
                space.peers.get(pid).isVideoOff = isVideoOff;
                socket.to(currentSpace).emit('media-state-update', { peerId: pid, isMuted, isVideoOff });
            }
        });

        socket.on('screen-share-started', ({ peerId: pid }) => {
            if (!currentSpace) return;
            const space = spaces.get(currentSpace);
            if (space?.peers.has(pid)) {
                space.peers.get(pid).isScreenSharing = true;
                socket.to(currentSpace).emit('screen-share-started', { peerId: pid, username: currentUsername });
            }
        });

        socket.on('screen-share-stopped', ({ peerId: pid }) => {
            if (!currentSpace) return;
            const space = spaces.get(currentSpace);
            if (space?.peers.has(pid)) {
                space.peers.get(pid).isScreenSharing = false;
                socket.to(currentSpace).emit('screen-share-stopped', { peerId: pid });
            }
        });

        socket.on('disconnect', () => {
            peerSockets.delete(peerId);
            
            if (currentSpace) {
                const space = spaces.get(currentSpace);
                if (space) {
                    space.peers.delete(peerId);
                    socket.to(currentSpace).emit('peer-left', { peerId });
                    console.log(`[Signaling] ${currentUsername} left space ${currentSpace} (${space.peers.size} peers)`);
                    if (space.peers.size === 0) {
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

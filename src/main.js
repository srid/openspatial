import './index.css';
import { SocketHandler } from './modules/socket.js';
import { WebRTCManager } from './modules/webrtc.js';
import { CanvasManager } from './modules/canvas.js';
import { AvatarManager } from './modules/avatar.js';
import { ScreenShareManager } from './modules/screenshare.js';
import { SpatialAudio } from './modules/spatial-audio.js';
import { UIController } from './modules/ui.js';
import { MinimapManager } from './modules/minimap.js';

// Application state
const state = {
    username: '',
    spaceId: '',
    peerId: null,
    peers: new Map(),
    localStream: null,
    screenStreams: new Map(), // shareId -> stream
    pendingShareIds: new Map(), // peerId -> [shareId] - queued shareIds from signaling, waiting for WebRTC track
    isMuted: false,
    isVideoOff: false
};

// Initialize modules
const socket = new SocketHandler();
const canvas = new CanvasManager();
const avatars = new AvatarManager(state);
const screenShare = new ScreenShareManager(
    state,
    (shareId, x, y) => socket.emit('screen-share-position-update', { shareId, x, y }),
    (shareId) => stopScreenShare(shareId)
);
const spatialAudio = new SpatialAudio();
const ui = new UIController(state);
let webrtc;

// DOM elements
const joinModal = document.getElementById('join-modal');
const joinForm = document.getElementById('join-form');
const canvasContainer = document.getElementById('canvas-container');
const usernameInput = document.getElementById('username');
const spaceIdInput = document.getElementById('space-id');

// Initialize
function init() {
    setupEventListeners();
    canvas.init();
    
    // Initialize minimap after canvas
    const minimap = new MinimapManager(canvas, canvas.spaceWidth, canvas.spaceHeight);
    minimap.init();
    
    // Check for space in URL path (permalink: /s/spacename)
    const pathMatch = window.location.pathname.match(/^\/s\/(.+)$/);
    if (pathMatch) {
        spaceIdInput.value = decodeURIComponent(pathMatch[1]);
        // Focus username since space is pre-filled
        usernameInput.focus();
    } else {
        usernameInput.focus();
    }
}

function setupEventListeners() {
    // Join form
    joinForm.addEventListener('submit', handleJoin);
    
    // Control buttons
    document.getElementById('btn-mic').addEventListener('click', toggleMic);
    document.getElementById('btn-camera').addEventListener('click', toggleCamera);
    document.getElementById('btn-screen').addEventListener('click', startScreenShare);
    document.getElementById('btn-leave').addEventListener('click', leaveSpace);
    
    // Socket events
    socket.on('connected', handleConnected);
    socket.on('peer-joined', handlePeerJoined);
    socket.on('peer-left', handlePeerLeft);
    socket.on('signal', handleSignal);
    socket.on('position-update', handlePositionUpdate);
    socket.on('media-state-update', handleMediaStateUpdate);
    socket.on('screen-share-started', handleScreenShareStarted);
    socket.on('screen-share-stopped', handleScreenShareStopped);
    socket.on('screen-share-position-update', handleScreenSharePositionUpdate);
    socket.on('space-state', handleSpaceState);
}

async function handleJoin(e) {
    e.preventDefault();
    
    state.username = usernameInput.value.trim();
    state.spaceId = spaceIdInput.value.trim();
    
    if (!state.username || !state.spaceId) return;
    
    try {
        // Get user media with mobile-friendly constraints
        const constraints = {
            video: {
                facingMode: 'user',
                width: { ideal: 640 },
                height: { ideal: 480 }
            },
            audio: true
        };
        
        try {
            state.localStream = await navigator.mediaDevices.getUserMedia(constraints);
        } catch (mediaError) {
            console.error('getUserMedia error:', mediaError.name, mediaError.message);
            
            // Provide helpful error messages
            if (mediaError.name === 'NotAllowedError') {
                alert('Camera/microphone access was denied. Please grant permission and try again.');
            } else if (mediaError.name === 'NotFoundError') {
                alert('No camera or microphone found on this device.');
            } else if (mediaError.name === 'NotReadableError') {
                alert('Camera/microphone is already in use by another application.');
            } else if (mediaError.name === 'OverconstrainedError') {
                // Try again with simpler constraints
                console.log('Retrying with basic constraints...');
                state.localStream = await navigator.mediaDevices.getUserMedia({
                    video: true,
                    audio: true
                });
            } else {
                alert(`Camera/microphone error: ${mediaError.name} - ${mediaError.message}`);
            }
            
            if (!state.localStream) return;
        }
        
        // Initialize WebRTC manager
        webrtc = new WebRTCManager(socket, state);
        
        // Connect to signaling server
        await socket.connect();
        
        // Join space
        socket.emit('join-space', {
            spaceId: state.spaceId,
            username: state.username
        });
        
    } catch (error) {
        console.error('Failed to join:', error);
        alert(`Failed to join: ${error.message}`);
    }
}

function handleConnected(data) {
    state.peerId = data.peerId;
    
    // Hide modal, show canvas
    joinModal.classList.add('hidden');
    canvasContainer.classList.remove('hidden');
    
    // Update space info and URL for permalink
    const spaceNameEl = document.getElementById('space-name');
    spaceNameEl.textContent = state.spaceId;
    history.replaceState(null, '', `/s/${encodeURIComponent(state.spaceId)}`);
    document.title = `${state.spaceId} - OpenSpatial`;
    
    // Make space name clickable to copy permalink
    spaceNameEl.style.cursor = 'pointer';
    spaceNameEl.title = 'Click to copy invite link';
    spaceNameEl.addEventListener('click', () => {
        const permalink = `${window.location.origin}/s/${encodeURIComponent(state.spaceId)}`;
        navigator.clipboard.writeText(permalink).then(() => {
            const original = spaceNameEl.textContent;
            spaceNameEl.textContent = 'Link copied!';
            setTimeout(() => spaceNameEl.textContent = original, 1500);
        });
    });
    
    // Create local avatar
    const centerX = 2000;
    const centerY = 2000;
    avatars.createLocalAvatar(state.peerId, state.username, state.localStream, centerX, centerY);
    
    // Center view on local avatar - wait for layout to be computed
    // Use double requestAnimationFrame to ensure CSS transitions complete
    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            canvas.centerOn(centerX, centerY);
        });
    });
    
    // Setup avatar drag handler
    avatars.onPositionChange((peerId, x, y) => {
        socket.emit('position-update', { peerId, x, y });
        spatialAudio.updatePositions(avatars.getPositions(), state.peerId);
    });
    
    updateParticipantCount();
}

function handleSpaceState(spaceState) {
    // Create avatars for existing peers
    for (const [peerId, peerData] of Object.entries(spaceState.peers)) {
        if (peerId !== state.peerId) {
            state.peers.set(peerId, peerData);
            avatars.createRemoteAvatar(
                peerId, 
                peerData.username, 
                peerData.position.x, 
                peerData.position.y
            );
            
            // Initiate WebRTC connection
            webrtc.createPeerConnection(peerId, true);
        }
    }
    
    updateParticipantCount();
}

function handlePeerJoined(data) {
    const { peerId, username, position } = data;
    
    state.peers.set(peerId, { username, position });
    avatars.createRemoteAvatar(peerId, username, position.x, position.y);
    
    // If we're screen sharing, we need to initiate the connection
    // so our offer includes the screen tracks
    if (state.screenStreams.size > 0 && webrtc) {
        webrtc.createPeerConnection(peerId, true);
    }
    // Otherwise wait for offer from the new peer
    
    updateParticipantCount();
}

function handlePeerLeft(data) {
    const { peerId } = data;
    
    state.peers.delete(peerId);
    avatars.removeAvatar(peerId);
    screenShare.removeScreenShare(peerId);
    spatialAudio.removePeer(peerId);
    webrtc?.closePeerConnection(peerId);
    
    updateParticipantCount();
}

function handleSignal(data) {
    webrtc?.handleSignal(data);
}

function handlePositionUpdate(data) {
    const { peerId, x, y } = data;
    avatars.updatePosition(peerId, x, y);
    spatialAudio.updatePositions(avatars.getPositions(), state.peerId);
}

function handleMediaStateUpdate(data) {
    const { peerId, isMuted, isVideoOff } = data;
    avatars.updateMediaState(peerId, isMuted, isVideoOff);
}

function handleScreenShareStarted(data) {
    const { peerId, shareId } = data;
    // Queue the shareId - when WebRTC track arrives, we'll use this ID
    if (!state.pendingShareIds.has(peerId)) {
        state.pendingShareIds.set(peerId, []);
    }
    state.pendingShareIds.get(peerId).push(shareId);
}

function handleScreenShareStopped(data) {
    const { shareId } = data;
    screenShare.removeScreenShare(shareId);
}

function handleScreenSharePositionUpdate(data) {
    const { shareId, x, y } = data;
    screenShare.setPosition(shareId, x, y);
}

function toggleMic() {
    state.isMuted = !state.isMuted;
    
    if (state.localStream) {
        state.localStream.getAudioTracks().forEach(track => {
            track.enabled = !state.isMuted;
        });
    }
    
    ui.updateMicButton(state.isMuted);
    avatars.updateMediaState(state.peerId, state.isMuted, state.isVideoOff);
    
    socket.emit('media-state-update', {
        peerId: state.peerId,
        isMuted: state.isMuted,
        isVideoOff: state.isVideoOff
    });
}

function toggleCamera() {
    state.isVideoOff = !state.isVideoOff;
    
    if (state.localStream) {
        state.localStream.getVideoTracks().forEach(track => {
            track.enabled = !state.isVideoOff;
        });
    }
    
    ui.updateCameraButton(state.isVideoOff);
    avatars.updateMediaState(state.peerId, state.isMuted, state.isVideoOff);
    
    socket.emit('media-state-update', {
        peerId: state.peerId,
        isMuted: state.isMuted,
        isVideoOff: state.isVideoOff
    });
}

async function startScreenShare() {
    try {
        const stream = await navigator.mediaDevices.getDisplayMedia({
            video: true,
            audio: true
        });
        
        // Use stream.id for shareId - this ID is sent in WebRTC and matches on remote
        const shareId = `${state.peerId}-${stream.id}`;
        state.screenStreams.set(shareId, stream);
        
        // Create local screen share element
        const localAvatar = avatars.getPosition(state.peerId);
        const offsetX = 150 + (state.screenStreams.size - 1) * 50; // Offset each share
        screenShare.createScreenShare(
            shareId,
            state.peerId,
            state.username, 
            stream,
            localAvatar.x + offsetX,
            localAvatar.y
        );
        
        // Add screen track to all peer connections
        webrtc?.addScreenTrack(shareId, stream);
        
        // Notify peers
        socket.emit('screen-share-started', { peerId: state.peerId, shareId });
        
        // Handle stream end (user clicks "Stop sharing" in browser)
        stream.getVideoTracks()[0].onended = () => {
            stopScreenShare(shareId);
        };
        
    } catch (error) {
        if (error.name !== 'NotAllowedError') {
            console.error('Screen share failed:', error);
        }
    }
}

function stopScreenShare(shareId) {
    const stream = state.screenStreams.get(shareId);
    if (stream) {
        stream.getTracks().forEach(track => track.stop());
        state.screenStreams.delete(shareId);
    }
    
    screenShare.removeScreenShare(shareId);
    webrtc?.removeScreenTrack(shareId);
    
    socket.emit('screen-share-stopped', { peerId: state.peerId, shareId });
}

function leaveSpace() {
    // Stop all streams
    if (state.localStream) {
        state.localStream.getTracks().forEach(track => track.stop());
    }
    state.screenStreams.forEach(stream => {
        stream.getTracks().forEach(track => track.stop());
    });
    
    // Close WebRTC connections
    webrtc?.closeAllConnections();
    
    // Disconnect socket
    socket.disconnect();
    
    // Clean up UI
    avatars.clear();
    screenShare.clear();
    
    // Reset state
    state.peers.clear();
    state.localStream = null;
    state.screenStreams.clear();
    state.peerId = null;
    state.isMuted = false;
    state.isVideoOff = false;
    
    // Reset URL to root (clear space permalink)
    history.replaceState(null, '', '/');
    document.title = 'OpenSpatial - Virtual Office';
    
    // Show modal
    canvasContainer.classList.add('hidden');
    joinModal.classList.remove('hidden');
    
    // Reset UI buttons
    ui.resetButtons();
}

function updateParticipantCount() {
    const count = state.peers.size + 1;
    document.getElementById('participant-count').textContent = 
        `${count} participant${count !== 1 ? 's' : ''}`;
}

// Start the app
init();

// Export for WebRTC module to access
export { avatars, screenShare, spatialAudio };

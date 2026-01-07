import './index.css';
import { SocketHandler, ConnectionState, ReconnectInfo } from './modules/socket.js';
import { WebRTCManager } from './modules/webrtc.js';
import { CanvasManager } from './modules/canvas.js';
import { AvatarManager } from './modules/avatar.js';
import { ScreenShareManager } from './modules/screenshare.js';
import { SpatialAudio } from './modules/spatial-audio.js';
import { UIController } from './modules/ui.js';
import { MinimapManager } from './modules/minimap.js';
import { CRDTManager } from './modules/crdt.js';
import type {
  SpaceInfoEvent,
  PeerLeftEvent,
  SignalEvent,
  PeerData,
} from '../shared/types/events.js';

// Pending share info for late-joining peers
interface PendingShareInfo {
  shareId: string;
  x?: number;
  y?: number;
}

// Application state
const state = {
  username: '',
  spaceId: '',
  peerId: null as string | null,
  peers: new Map<string, PeerData>(),
  localStream: null as MediaStream | null,
  screenStreams: new Map<string, MediaStream>(),
  pendingShareIds: new Map<string, (string | PendingShareInfo)[]>(),
  isMuted: false,
  isVideoOff: false,
  status: '',
};

// Initialize modules
const socket = new SocketHandler();
const canvas = new CanvasManager();
const avatars = new AvatarManager(state);
const crdt = new CRDTManager();
const screenShare = new ScreenShareManager(
  state,
  // Use CRDT for position/resize sync instead of socket
  (shareId, x, y) => crdt.updateScreenSharePosition(shareId, x, y),
  (shareId, width, height) => crdt.updateScreenShareSize(shareId, width, height),
  (shareId) => stopScreenShare(shareId)
);
const spatialAudio = new SpatialAudio();
spatialAudio.setAvatarManager(avatars);
const ui = new UIController(state);
let webrtc: WebRTCManager | null = null;

// DOM elements
const joinModal = document.getElementById('join-modal') as HTMLElement;
const joinForm = document.getElementById('join-form') as HTMLFormElement;
const canvasContainer = document.getElementById('canvas-container') as HTMLElement;
const usernameInput = document.getElementById('username') as HTMLInputElement;
const spaceIdInput = document.getElementById('space-id') as HTMLInputElement;
const spaceParticipants = document.getElementById('space-participants') as HTMLElement;

// Preview socket for pre-join space info
let previewSocket: SocketHandler | null = null;

// Initialize
function init(): void {
  setupEventListeners();
  canvas.init();

  const minimap = new MinimapManager(canvas, 4000, 4000);
  minimap.init();

  const pathMatch = window.location.pathname.match(/^\/s\/(.+)$/);
  if (pathMatch) {
    const spaceId = decodeURIComponent(pathMatch[1]);
    spaceIdInput.value = spaceId;
    spaceIdInput.readOnly = true;
    usernameInput.focus();

    // Query space info for preview
    querySpaceInfo(spaceId);
  } else {
    usernameInput.focus();
  }
}

async function querySpaceInfo(spaceId: string): Promise<void> {
  previewSocket = new SocketHandler();
  
  previewSocket.on('space-info', (data: SpaceInfoEvent) => {
    displaySpaceParticipants(data.participants);
    // Disconnect preview socket after getting info
    previewSocket?.disconnect();
    previewSocket = null;
  });

  try {
    await previewSocket.connect();
    previewSocket.emit('get-space-info', { spaceId });
  } catch (error) {
    console.error('Failed to query space info:', error);
  }
}

function displaySpaceParticipants(participants: string[]): void {
  if (participants.length === 0) {
    spaceParticipants.classList.add('empty');
    spaceParticipants.textContent = 'No one here yet — be the first to join!';
  } else {
    spaceParticipants.classList.remove('empty');
    const label = participants.length === 1 ? 'Currently here:' : `${participants.length} people here:`;
    spaceParticipants.innerHTML = `
      ${label}
      <div class="participant-list">
        ${participants.map(name => `<span class="participant-name">${name}</span>`).join('')}
      </div>
    `;
  }
  spaceParticipants.classList.remove('hidden');
}

function setupEventListeners(): void {
  joinForm.addEventListener('submit', handleJoin);

  document.getElementById('btn-mic')!.addEventListener('click', toggleMic);
  document.getElementById('btn-camera')!.addEventListener('click', toggleCamera);
  document.getElementById('btn-screen')!.addEventListener('click', startScreenShare);
  document.getElementById('btn-leave')!.addEventListener('click', leaveSpace);
  document.getElementById('btn-set-status')!.addEventListener('click', setStatus);
  document.getElementById('btn-clear-status')!.addEventListener('click', clearStatus);
  document.getElementById('status-input')!.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      setStatus();
    }
  });

  // Socket events: only WebRTC signaling
  socket.on('signal', handleSignal);
  socket.on('peer-left', handlePeerLeft);
  socket.on('reconnected', handleReconnected);

  // Set up connection state handler for UI feedback
  socket.onConnectionStateChange(handleConnectionStateChange);

  // CRDT observers for state sync (replaces socket-based sync)
  crdt.observePeers((peers) => {
    for (const [peerId, peerState] of peers) {
      if (peerId === state.peerId) continue; // Skip self
      
      // Update or create remote avatar
      if (!avatars.hasAvatar(peerId)) {
        avatars.createRemoteAvatar(peerId, peerState.username, peerState.x, peerState.y);
        state.peers.set(peerId, {
          username: peerState.username,
          position: { x: peerState.x, y: peerState.y },
          isMuted: peerState.isMuted,
          isVideoOff: peerState.isVideoOff,
          isScreenSharing: peerState.isScreenSharing,
          status: peerState.status,
        });
        
        // Apply media state
        if (peerState.isMuted || peerState.isVideoOff) {
          avatars.updateMediaState(peerId, peerState.isMuted, peerState.isVideoOff);
        }
        
        // Apply status
        if (peerState.status) {
          avatars.updateStatus(peerId, peerState.status);
        }
        
        // Create WebRTC connection for new peer
        if (webrtc) {
          webrtc.createPeerConnection(peerId, true);
        }
        
        updateParticipantCount();
      } else {
        // Update existing avatar
        avatars.updatePosition(peerId, peerState.x, peerState.y);
        avatars.updateMediaState(peerId, peerState.isMuted, peerState.isVideoOff);
        if (peerState.status !== undefined) {
          avatars.updateStatus(peerId, peerState.status);
        }
      }
    }
    
    // Handle peer removal (peer left)
    for (const peerId of state.peers.keys()) {
      if (!peers.has(peerId)) {
        state.peers.delete(peerId);
        avatars.removeAvatar(peerId);
        screenShare.removeScreenSharesByPeerId(peerId);
        spatialAudio.removePeer(peerId);
        webrtc?.closePeerConnection(peerId);
        updateParticipantCount();
      }
    }
    
    spatialAudio.updatePositions(avatars.getPositions(), state.peerId!);
  });

  crdt.observeScreenShares((shares) => {
    for (const [shareId, shareState] of shares) {
      if (shareState.peerId === state.peerId) continue; // Skip own shares
      
      // Update or create screen share
      if (!screenShare.hasScreenShare(shareId)) {
        // Screen share will be created when WebRTC track arrives
        // Just queue the position info
        if (!state.pendingShareIds.has(shareState.peerId)) {
          state.pendingShareIds.set(shareState.peerId, []);
        }
        state.pendingShareIds.get(shareState.peerId)!.push({
          shareId,
          x: shareState.x,
          y: shareState.y,
        });
      } else {
        // Update existing screen share position/size
        screenShare.setPosition(shareId, shareState.x, shareState.y);
        if (shareState.width && shareState.height) {
          screenShare.setSize(shareId, shareState.width, shareState.height);
        }
      }
    }
    
    // Handle screen share removal
    screenShare.forEachShare((shareId, _element) => {
      if (!shares.has(shareId)) {
        screenShare.removeScreenShare(shareId);
      }
    });
  });

  // Browser offline/online detection for immediate feedback
  window.addEventListener('offline', () => {
    console.log('Browser went offline');
    ui.showDisconnected();
  });

  window.addEventListener('online', () => {
    console.log('Browser came back online');
    ui.showConnected();
  });
}

function handleConnectionStateChange(state: ConnectionState, info?: ReconnectInfo): void {
  switch (state) {
    case 'disconnected':
      ui.showDisconnected();
      break;
    case 'reconnecting':
      if (info) {
        ui.showReconnecting(info.attempt, info.maxAttempts);
      }
      break;
    case 'connected':
      ui.showConnected();
      break;
  }
}

function handleReconnected(): void {
  console.log('Reconnected - rejoining space');
  ui.showConnected();

  // Re-emit join-space to rejoin the room after reconnection
  if (state.spaceId && state.username) {
    socket.emit('join-space', {
      spaceId: state.spaceId,
      username: state.username,
    });
  }
}

async function handleJoin(e: Event): Promise<void> {
  e.preventDefault();

  state.username = usernameInput.value.trim();
  state.spaceId = spaceIdInput.value.trim();

  if (!state.username || !state.spaceId) return;

  try {
    const constraints: MediaStreamConstraints = {
      video: {
        facingMode: 'user',
        width: { ideal: 640 },
        height: { ideal: 480 },
      },
      audio: true,
    };

    try {
      state.localStream = await navigator.mediaDevices.getUserMedia(constraints);
    } catch (mediaError) {
      const err = mediaError as DOMException;
      console.error('getUserMedia error:', err.name, err.message);

      if (err.name === 'NotAllowedError') {
        alert('Camera/microphone access was denied. Please grant permission and try again.');
      } else if (err.name === 'NotFoundError') {
        alert('No camera or microphone found on this device.');
      } else if (err.name === 'NotReadableError') {
        alert('Camera/microphone is already in use by another application.');
      } else if (err.name === 'OverconstrainedError') {
        console.log('Retrying with basic constraints...');
        state.localStream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true,
        });
      } else {
        alert(`Camera/microphone error: ${err.name} - ${err.message}`);
      }

      if (!state.localStream) return;
    }

    webrtc = new WebRTCManager(socket, state);
    webrtc.setManagers(avatars, screenShare, spatialAudio);

    // Connect socket for WebRTC signaling
    await socket.connect();

    // Emit join-space and wait for connected event with peerId
    socket.emit('join-space', {
      spaceId: state.spaceId,
      username: state.username,
    });

    // Wait for connected event to get server-assigned peerId
    const connectedData = await new Promise<{ peerId: string }>((resolve) => {
      socket.once('connected', (data: { peerId: string }) => {
        resolve(data);
      });
    });

    state.peerId = connectedData.peerId;

    // Connect CRDT for state sync using the socket peerId
    const { position } = await crdt.connect(state.spaceId, state.peerId, state.username);

    // Show UI
    joinModal.classList.add('hidden');
    canvasContainer.classList.remove('hidden');

    const spaceNameEl = document.getElementById('space-name') as HTMLElement;
    spaceNameEl.textContent = state.spaceId;
    history.replaceState(null, '', `/s/${encodeURIComponent(state.spaceId)}`);
    document.title = `${state.spaceId} - OpenSpatial`;

    spaceNameEl.style.cursor = 'pointer';
    spaceNameEl.title = 'Click to copy invite link';
    spaceNameEl.addEventListener('click', () => {
      const permalink = `${window.location.origin}/s/${encodeURIComponent(state.spaceId)}`;
      navigator.clipboard.writeText(permalink).then(() => {
        const original = spaceNameEl.textContent;
        spaceNameEl.textContent = 'Link copied!';
        setTimeout(() => (spaceNameEl.textContent = original), 1500);
      });
    });

    // Create local avatar at the position assigned by CRDT
    avatars.createLocalAvatar(state.peerId, state.username, state.localStream!, position.x, position.y);

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        canvas.centerOn(position.x, position.y);
      });
    });

    avatars.onPositionChange((peerId, x, y) => {
      crdt.updatePosition(peerId, x, y);
      spatialAudio.updatePositions(avatars.getPositions(), state.peerId!);
    });

    updateParticipantCount();
  } catch (error) {
    const err = error as Error;
    console.error('Failed to join:', err);
    alert(`Failed to join: ${err.message}`);
  }
}







function handlePeerLeft(data: PeerLeftEvent): void {
  const { peerId } = data;

  state.peers.delete(peerId);
  avatars.removeAvatar(peerId);
  screenShare.removeScreenSharesByPeerId(peerId);
  spatialAudio.removePeer(peerId);
  webrtc?.closePeerConnection(peerId);

  updateParticipantCount();
}

function handleSignal(data: SignalEvent): void {
  webrtc?.handleSignal(data);
}

function toggleMic(): void {
  state.isMuted = !state.isMuted;

  if (state.localStream) {
    state.localStream.getAudioTracks().forEach((track) => {
      track.enabled = !state.isMuted;
    });
  }

  ui.updateMicButton(state.isMuted);
  avatars.updateMediaState(state.peerId!, state.isMuted, state.isVideoOff);
  crdt.updateMediaState(state.peerId!, state.isMuted, state.isVideoOff);
}

function toggleCamera(): void {
  state.isVideoOff = !state.isVideoOff;

  if (state.localStream) {
    state.localStream.getVideoTracks().forEach((track) => {
      track.enabled = !state.isVideoOff;
    });
  }

  ui.updateCameraButton(state.isVideoOff);
  avatars.updateMediaState(state.peerId!, state.isMuted, state.isVideoOff);
  crdt.updateMediaState(state.peerId!, state.isMuted, state.isVideoOff);
}

function setStatus(): void {
  const statusInput = document.getElementById('status-input') as HTMLInputElement;
  const newStatus = statusInput.value.trim();
  
  state.status = newStatus;
  avatars.updateStatus(state.peerId!, newStatus);
  crdt.updateStatus(state.peerId!, newStatus);
}

function clearStatus(): void {
  const statusInput = document.getElementById('status-input') as HTMLInputElement;
  statusInput.value = '';
  
  state.status = '';
  avatars.updateStatus(state.peerId!, '');
  crdt.updateStatus(state.peerId!, '');
}

async function startScreenShare(): Promise<void> {
  try {
    const stream = await navigator.mediaDevices.getDisplayMedia({
      video: true,
      audio: true,
    });

    const shareId = `${state.peerId}-${stream.id}`;
    state.screenStreams.set(shareId, stream);

    const localAvatar = avatars.getPosition(state.peerId!);
    const offsetX = 150 + (state.screenStreams.size - 1) * 50;
    screenShare.createScreenShare(shareId, state.peerId!, state.username, stream, localAvatar.x + offsetX, localAvatar.y);

    webrtc?.addScreenTrack(shareId, stream);

    const x = localAvatar.x + offsetX;
    const y = localAvatar.y;
    // Add to CRDT for state sync (also notifies other clients about screen share)
    crdt.addScreenShare(shareId, {
      peerId: state.peerId!,
      username: state.username,
      x,
      y,
    });
    // Also emit via socket for WebRTC track coordination
    socket.emit('screen-share-started', { peerId: state.peerId!, shareId, x, y });

    stream.getVideoTracks()[0].onended = () => {
      stopScreenShare(shareId);
    };
  } catch (error) {
    const err = error as Error;
    if (err.name !== 'NotAllowedError') {
      console.error('Screen share failed:', err);
    }
  }
}

function stopScreenShare(shareId: string): void {
  const stream = state.screenStreams.get(shareId);
  if (stream) {
    stream.getTracks().forEach((track) => track.stop());
    state.screenStreams.delete(shareId);
  }

  screenShare.removeScreenShare(shareId);
  webrtc?.removeScreenTrack(shareId);

  // Remove from CRDT
  crdt.removeScreenShare(shareId);
  // Also emit via socket for WebRTC cleanup
  socket.emit('screen-share-stopped', { peerId: state.peerId!, shareId });
}

function leaveSpace(): void {
  if (state.localStream) {
    state.localStream.getTracks().forEach((track) => track.stop());
  }
  state.screenStreams.forEach((stream) => {
    stream.getTracks().forEach((track) => track.stop());
  });

  webrtc?.closeAllConnections();
  crdt.disconnect();
  socket.disconnect();

  avatars.clear();
  screenShare.clear();

  state.peers.clear();
  state.localStream = null;
  state.screenStreams.clear();
  state.peerId = null;
  state.isMuted = false;
  state.isVideoOff = false;

  history.replaceState(null, '', '/');
  document.title = 'OpenSpatial - Virtual Office';

  canvasContainer.classList.add('hidden');
  joinModal.classList.remove('hidden');

  ui.resetButtons();
}

function updateParticipantCount(): void {
  const count = state.peers.size + 1;
  document.getElementById('participant-count')!.textContent = `${count} participant${count !== 1 ? 's' : ''}`;
}

// Start the app
init();

// Export for WebRTC module to access
export { avatars, screenShare, spatialAudio };

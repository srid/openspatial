import './index.css';
import { SocketHandler } from './modules/socket.js';
import { WebRTCManager } from './modules/webrtc.js';
import { CanvasManager } from './modules/canvas.js';
import { AvatarManager } from './modules/avatar.js';
import { ScreenShareManager } from './modules/screenshare.js';
import { SpatialAudio } from './modules/spatial-audio.js';
import { UIController } from './modules/ui.js';
import { MinimapManager } from './modules/minimap.js';
import type {
  ConnectedEvent,
  SpaceStateEvent,
  PeerJoinedEvent,
  PeerLeftEvent,
  SignalEvent,
  PositionUpdateEvent,
  MediaStateUpdateEvent,
  ScreenShareStartedBroadcast,
  ScreenShareStoppedBroadcast,
  ScreenSharePositionUpdateEvent,
  PeerData,
  ScreenShareData,
} from './types/events.js';

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
spatialAudio.setAvatarManager(avatars);
const ui = new UIController(state);
let webrtc: WebRTCManager | null = null;

// DOM elements
const joinModal = document.getElementById('join-modal') as HTMLElement;
const joinForm = document.getElementById('join-form') as HTMLFormElement;
const canvasContainer = document.getElementById('canvas-container') as HTMLElement;
const usernameInput = document.getElementById('username') as HTMLInputElement;
const spaceIdInput = document.getElementById('space-id') as HTMLInputElement;

// Initialize
function init(): void {
  setupEventListeners();
  canvas.init();

  const minimap = new MinimapManager(canvas, 4000, 4000);
  minimap.init();

  const pathMatch = window.location.pathname.match(/^\/s\/(.+)$/);
  if (pathMatch) {
    spaceIdInput.value = decodeURIComponent(pathMatch[1]);
    usernameInput.focus();
  } else {
    usernameInput.focus();
  }
}

function setupEventListeners(): void {
  joinForm.addEventListener('submit', handleJoin);

  document.getElementById('btn-mic')!.addEventListener('click', toggleMic);
  document.getElementById('btn-camera')!.addEventListener('click', toggleCamera);
  document.getElementById('btn-screen')!.addEventListener('click', startScreenShare);
  document.getElementById('btn-leave')!.addEventListener('click', leaveSpace);

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

    await socket.connect();

    socket.emit('join-space', {
      spaceId: state.spaceId,
      username: state.username,
    });
  } catch (error) {
    const err = error as Error;
    console.error('Failed to join:', err);
    alert(`Failed to join: ${err.message}`);
  }
}

function handleConnected(data: ConnectedEvent): void {
  state.peerId = data.peerId;

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

  const centerX = 2000;
  const centerY = 2000;
  avatars.createLocalAvatar(state.peerId, state.username, state.localStream!, centerX, centerY);

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      canvas.centerOn(centerX, centerY);
    });
  });

  avatars.onPositionChange((peerId, x, y) => {
    socket.emit('position-update', { peerId, x, y });
    spatialAudio.updatePositions(avatars.getPositions(), state.peerId!);
  });

  updateParticipantCount();
}

function handleSpaceState(spaceState: SpaceStateEvent): void {
  for (const [peerId, peerData] of Object.entries(spaceState.peers)) {
    if (peerId !== state.peerId) {
      state.peers.set(peerId, peerData);
      avatars.createRemoteAvatar(peerId, peerData.username, peerData.position.x, peerData.position.y);

      webrtc!.createPeerConnection(peerId, true);
    }
  }

  if (spaceState.screenShares) {
    for (const [shareId, shareData] of Object.entries(spaceState.screenShares)) {
      if (shareData.peerId !== state.peerId) {
        if (!state.pendingShareIds.has(shareData.peerId)) {
          state.pendingShareIds.set(shareData.peerId, []);
        }
        state.pendingShareIds.get(shareData.peerId)!.push({
          shareId,
          x: shareData.x,
          y: shareData.y,
        });
      }
    }
  }

  updateParticipantCount();
}

function handlePeerJoined(data: PeerJoinedEvent): void {
  const { peerId, username, position } = data;

  state.peers.set(peerId, { username, position, isMuted: false, isVideoOff: false, isScreenSharing: false });
  avatars.createRemoteAvatar(peerId, username, position.x, position.y);

  if (state.screenStreams.size > 0 && webrtc) {
    webrtc.createPeerConnection(peerId, true);
  }

  updateParticipantCount();
}

function handlePeerLeft(data: PeerLeftEvent): void {
  const { peerId } = data;

  state.peers.delete(peerId);
  avatars.removeAvatar(peerId);
  screenShare.removeScreenShare(peerId);
  spatialAudio.removePeer(peerId);
  webrtc?.closePeerConnection(peerId);

  updateParticipantCount();
}

function handleSignal(data: SignalEvent): void {
  webrtc?.handleSignal(data);
}

function handlePositionUpdate(data: PositionUpdateEvent): void {
  const { peerId, x, y } = data;
  avatars.updatePosition(peerId, x, y);
  spatialAudio.updatePositions(avatars.getPositions(), state.peerId!);
}

function handleMediaStateUpdate(data: MediaStateUpdateEvent): void {
  const { peerId, isMuted, isVideoOff } = data;
  avatars.updateMediaState(peerId, isMuted, isVideoOff);
}

function handleScreenShareStarted(data: ScreenShareStartedBroadcast): void {
  const { peerId, shareId } = data;
  if (!state.pendingShareIds.has(peerId)) {
    state.pendingShareIds.set(peerId, []);
  }
  state.pendingShareIds.get(peerId)!.push(shareId);
}

function handleScreenShareStopped(data: ScreenShareStoppedBroadcast): void {
  const { shareId } = data;
  screenShare.removeScreenShare(shareId);
}

function handleScreenSharePositionUpdate(data: ScreenSharePositionUpdateEvent): void {
  const { shareId, x, y } = data;
  screenShare.setPosition(shareId, x, y);
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

  socket.emit('media-state-update', {
    peerId: state.peerId!,
    isMuted: state.isMuted,
    isVideoOff: state.isVideoOff,
  });
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

  socket.emit('media-state-update', {
    peerId: state.peerId!,
    isMuted: state.isMuted,
    isVideoOff: state.isVideoOff,
  });
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

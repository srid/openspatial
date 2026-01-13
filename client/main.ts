import './index.css';
import { SocketHandler, ConnectionState, ReconnectInfo } from './modules/socket.js';
import { WebRTCManager } from './modules/webrtc.js';
import { CanvasManager } from './modules/canvas.js';
import { AvatarManager } from './modules/avatar.js';
import { ScreenShareManager } from './modules/screenshare.js';
import { TextNoteManager } from './modules/textnote.js';
import { SpatialAudio } from './modules/spatial-audio.js';
import { UIController } from './modules/ui.js';
import { MinimapManager } from './modules/minimap.js';
import { CRDTManager } from './modules/crdt.js';
import type {
  ConnectedEvent,
  SpaceStateEvent,
  SpaceInfoEvent,
  PeerJoinedEvent,
  PeerLeftEvent,
  SignalEvent,
  ScreenShareStartedBroadcast,
  ScreenShareStoppedBroadcast,
  PeerData,
  ScreenShareData,
} from '../shared/types/events.js';

// Pending share info for late-joining peers
interface PendingShareInfo {
  shareId: string;
  x: number;
  y: number;
  width: number;
  height: number;
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
const screenShare = new ScreenShareManager(
  state,
  (shareId, x, y) => crdt?.updateScreenSharePosition(shareId, x, y),
  (shareId, width, height) => crdt?.updateScreenShareSize(shareId, width, height),
  (shareId) => stopScreenShare(shareId)
);
const textNote = new TextNoteManager(
  state,
  (noteId, x, y) => crdt?.updateTextNotePosition(noteId, x, y),
  (noteId, width, height) => crdt?.updateTextNoteSize(noteId, width, height),
  (noteId, content) => crdt?.updateTextNoteContent(noteId, content),
  (noteId, fontSize, color) => crdt?.updateTextNoteStyle(noteId, fontSize, color),
  (noteId) => removeTextNote(noteId)
);
const spatialAudio = new SpatialAudio();
spatialAudio.setAvatarManager(avatars);
const ui = new UIController(state);
let webrtc: WebRTCManager | null = null;
let crdt: CRDTManager | null = null;

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

    // Show loading state immediately (before Socket.io connection)
    showSpaceParticipantsLoading();
    
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

function showSpaceParticipantsLoading(): void {
  spaceParticipants.classList.remove('hidden');
  spaceParticipants.classList.add('loading');
  spaceParticipants.innerHTML = `
    <svg class="spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
    </svg>
    Checking who's here...
  `;
}

function displaySpaceParticipants(participants: string[]): void {
  spaceParticipants.classList.remove('loading');
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
  document.getElementById('btn-note')!.addEventListener('click', createTextNote);
  document.getElementById('btn-leave')!.addEventListener('click', leaveSpace);

  socket.on('connected', handleConnected);
  socket.on('peer-joined', handlePeerJoined);
  socket.on('peer-left', handlePeerLeft);
  socket.on('signal', handleSignal);
  // Note: position-update, media-state-update, status-update now handled by CRDT observers
  socket.on('screen-share-started', handleScreenShareStarted);
  socket.on('screen-share-stopped', handleScreenShareStopped);
  // Note: screen-share-position-update, screen-share-resize-update now handled by CRDT observers
  socket.on('space-state', handleSpaceState);
  socket.on('reconnected', handleReconnected);

  // Set up connection state handler for UI feedback
  socket.onConnectionStateChange(handleConnectionStateChange);

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
  const previousPeerId = state.peerId;
  const isReconnection = previousPeerId !== null;
  
  state.peerId = data.peerId;

  if (isReconnection) {
    // Reconnection: Clean up stale state
    console.log(`Reconnected with new peerId: ${data.peerId} (was: ${previousPeerId})`);
    
    // Update local avatar's peerId reference
    avatars.updateLocalPeerId(previousPeerId, data.peerId);
    
    // Clear stale remote peers (they may have left while we were disconnected)
    state.peers.clear();
    
    // Close old peer connections - they're invalid now
    webrtc?.closeAllConnections();
    
    // Reconnect CRDT
    crdt?.destroy();
    crdt = new CRDTManager(state.spaceId);
    setupCRDTObservers();
    
    updateParticipantCount();
    return;
  }

  // First-time join: Show UI and create local avatar
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

  // Initialize CRDT and add local peer to the document
  crdt = new CRDTManager(state.spaceId);
  crdt.addPeer(state.peerId, state.username, centerX, centerY);
  setupCRDTObservers();

  avatars.onPositionChange((peerId, x, y) => {
    crdt?.updatePosition(peerId, x, y);
    spatialAudio.updatePositions(avatars.getPositions(), state.peerId!);
  });

  avatars.onStatusChange((newStatus) => {
    state.status = newStatus;
    avatars.updateStatus(state.peerId!, newStatus);
    crdt?.updateStatus(state.peerId!, newStatus);
  });

  updateParticipantCount();
}

// Set up CRDT observers for remote state changes
function setupCRDTObservers(): void {
  if (!crdt) return;

  // Observe peer state changes (position, media state, status)
  // Uses CRDT-driven creation: if avatar doesn't exist, create it from CRDT data
  crdt.observePeers((peers) => {
    for (const [peerId, peerState] of peers) {
      if (peerId === state.peerId) continue; // Skip local peer
      
      // CRDT-driven creation: if avatar doesn't exist, create it from CRDT data
      // This handles the race condition where CRDT state arrives before Socket.io signaling
      if (!avatars.hasAvatar(peerId)) {
        console.log(`[CRDT] Creating avatar for ${peerId} from CRDT data`);
        state.peers.set(peerId, { 
          username: peerState.username, 
          position: { x: peerState.x, y: peerState.y },
          isMuted: peerState.isMuted,
          isVideoOff: peerState.isVideoOff,
          isScreenSharing: false
        });
        avatars.createRemoteAvatar(peerId, peerState.username, peerState.x, peerState.y);
        updateParticipantCount();
        
        // Initiate WebRTC connection if we have a local stream
        if (state.localStream && webrtc) {
          webrtc.createPeerConnection(peerId, true);
        }
      }
      
      // Update position
      avatars.updatePosition(peerId, peerState.x, peerState.y);
      
      // Update media state
      avatars.updateMediaState(peerId, peerState.isMuted, peerState.isVideoOff);
      
      // Update status (always call to handle clearing status)
      avatars.updateStatus(peerId, peerState.status);
    }
    spatialAudio.updatePositions(avatars.getPositions(), state.peerId!);
  });

  // Observe screen share state changes
  crdt.observeScreenShares((shares) => {
    for (const [shareId, shareState] of shares) {
      if (shareState.peerId === state.peerId) continue; // Skip local shares
      
      // Update position and size
      screenShare.setPosition(shareId, shareState.x, shareState.y);
      screenShare.setSize(shareId, shareState.width, shareState.height);
    }
  });

  // Observe text note state changes
  // Track which note IDs we've created DOM elements for
  const existingNoteIds = new Set<string>();
  
  crdt.observeTextNotes((notes) => {
    // Track which notes exist in CRDT
    const crdtNoteIds = new Set(notes.keys());
    
    // Remove notes that no longer exist in CRDT
    for (const noteId of existingNoteIds) {
      if (!crdtNoteIds.has(noteId)) {
        textNote.removeTextNote(noteId);
        existingNoteIds.delete(noteId);
      }
    }
    
    for (const [noteId, noteState] of notes) {
      // Create if doesn't exist
      if (!existingNoteIds.has(noteId)) {
        textNote.createTextNote(
          noteId,
          noteState.peerId,
          noteState.username,
          noteState.content,
          noteState.x,
          noteState.y,
          noteState.width,
          noteState.height,
          noteState.fontSize,
          noteState.fontFamily,
          noteState.color
        );
        existingNoteIds.add(noteId);
      }
      
      // For remote notes, update state
      if (noteState.peerId !== state.peerId) {
        textNote.setPosition(noteId, noteState.x, noteState.y);
        textNote.setSize(noteId, noteState.width, noteState.height);
        textNote.setContent(noteId, noteState.content);
        textNote.setFontSize(noteId, noteState.fontSize);
        textNote.setFontFamily(noteId, noteState.fontFamily);
        textNote.setColor(noteId, noteState.color);
      }
    }
  });
}

function handleSpaceState(spaceState: SpaceStateEvent): void {
  for (const [peerId, peerData] of Object.entries(spaceState.peers)) {
    if (peerId === state.peerId) {
      // Apply server-assigned position to local avatar and CRDT
      avatars.setPosition(peerId, peerData.position.x, peerData.position.y);
      canvas.centerOn(peerData.position.x, peerData.position.y);
      // Update CRDT with server-assigned position so other peers see it correctly
      crdt?.updatePosition(peerId, peerData.position.x, peerData.position.y);
    } else {
      state.peers.set(peerId, peerData);
      avatars.createRemoteAvatar(peerId, peerData.username, peerData.position.x, peerData.position.y);

      // Apply existing peer status if set
      // NOTE: Status is also managed by CRDT, but we apply Socket.io state first
      // since it arrives faster. CRDT observer will update with latest state.
      if (peerData.status) {
        avatars.updateStatus(peerId, peerData.status);
      }

      // NOTE: Media state (isMuted, isVideoOff) is now managed by CRDT observers.
      // The server no longer tracks media state, so peerData values are defaults.

      webrtc!.createPeerConnection(peerId, true);
    }
  }

  // NOTE: Screen shares are managed by CRDT, not Socket.io
  // Late-joiners will receive screen share state from CRDT observer

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
  screenShare.removeScreenSharesByPeerId(peerId);
  spatialAudio.removePeer(peerId);
  webrtc?.closePeerConnection(peerId);

  updateParticipantCount();
}

function handleSignal(data: SignalEvent): void {
  webrtc?.handleSignal(data);
}

// Legacy handlers removed - these are now handled by CRDT observers:
// - handlePositionUpdate
// - handleMediaStateUpdate  
// - handleStatusUpdate
// - handleScreenSharePositionUpdate
// - handleScreenShareResizeUpdate

// These handlers are still needed for WebRTC track signaling:
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
  crdt?.removeScreenShare(shareId);
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

  crdt?.updateMediaState(state.peerId!, state.isMuted, state.isVideoOff);
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

  crdt?.updateMediaState(state.peerId!, state.isMuted, state.isVideoOff);
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
    const x = localAvatar.x + offsetX;
    const y = localAvatar.y;
    const width = 480;
    const height = 320;

    screenShare.createScreenShare(shareId, state.peerId!, state.username, stream, x, y);
    webrtc?.addScreenTrack(shareId, stream);

    // Add to CRDT for sync
    crdt?.addScreenShare(shareId, state.peerId!, state.username, x, y, width, height);

    // Still need socket for WebRTC track signaling (position/size is CRDT-only)
    socket.emit('screen-share-started', { peerId: state.peerId!, shareId });

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
  crdt?.removeScreenShare(shareId);

  // Still need socket for WebRTC track cleanup signaling
  socket.emit('screen-share-stopped', { peerId: state.peerId!, shareId });
}

function createTextNote(): void {
  if (!state.peerId) return;
  
  const noteId = `${state.peerId}-note-${Date.now()}`;
  const localPos = avatars.getPosition(state.peerId);
  // Place note near the avatar
  const x = localPos.x + 150;
  const y = localPos.y - 50;
  
  // Add to CRDT
  crdt?.addTextNote(noteId, state.peerId, state.username, '', x, y, 250, 150);
}

function removeTextNote(noteId: string): void {
  textNote.removeTextNote(noteId);
  crdt?.removeTextNote(noteId);
}

function leaveSpace(): void {
  if (state.localStream) {
    state.localStream.getTracks().forEach((track) => track.stop());
  }
  state.screenStreams.forEach((stream) => {
    stream.getTracks().forEach((track) => track.stop());
  });

  // Clean up CRDT: remove local peer and destroy connection
  if (state.peerId) {
    crdt?.removePeer(state.peerId);
  }
  crdt?.destroy();
  crdt = null;

  webrtc?.closeAllConnections();
  socket.disconnect();

  avatars.clear();
  screenShare.clear();
  textNote.clear();

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

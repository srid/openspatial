/**
 * OpenSpatial Client Entry Point
 * SolidJS-based application with fine-grained reactivity.
 * Integrates with legacy DOM-based modules for canvas, avatars, etc.
 */
import './index.css';
import { render } from 'solid-js/web';
import { App } from './components/App';
import { 
  route, setRoute, 
  setSpaceName, setPeerId, setJoinParticipants, setJoinError,
  setConnectionState, setReconnectAttempt,
  addParticipant, updateParticipant, removeParticipant, clearParticipants,
  participantCount,
  addActivity,
  toggleMuted, toggleVideoOff, setScreenSharing,
  mediaState,
} from './store/app';

import { checkBrowser } from './modules/browser-check.js';
import { SocketHandler, ConnectionState, ReconnectInfo } from './modules/socket.js';
import { WebRTCManager } from './modules/webrtc.js';
import { CanvasManager } from './modules/canvas.js';
import { AvatarManager } from './modules/avatar.js';
import { ScreenShareManager } from './modules/screenshare.js';
import { TextNoteManager } from './modules/textnote.js';
import { SpatialAudio } from './modules/spatial-audio.js';
import { MinimapManager } from './modules/minimap.js';
import { CRDTManager } from './modules/crdt.js';
import { MediaControls } from './modules/media-controls.js';
import { UIController } from './modules/ui.js';
import { ActivityPanel } from './modules/activity-panel.js';
import type { SpaceInfoEvent, PeerData } from '../shared/types/events.js';
import type { AppState, PendingShareInfo } from '../shared/types/state.js';

// ==================== Application State ====================

const state: AppState = {
  username: '',
  spaceId: '',
  peerId: null,
  peers: new Map<string, PeerData>(),
  localStream: null,
  screenStreams: new Map<string, MediaStream>(),
  pendingShareIds: new Map<string, (string | PendingShareInfo)[]>(),
  isMuted: false,
  isVideoOff: false,
  status: '',
};

// ==================== Module Instances ====================

let crdt: CRDTManager | null = null;
let webrtc: WebRTCManager | null = null;
let ui: UIController | null = null;
let canvas: CanvasManager | null = null;
let minimap: MinimapManager | null = null;

const socket = new SocketHandler();
const avatars = new AvatarManager(state);
const spatialAudio = new SpatialAudio();
spatialAudio.setAvatarManager(avatars);
let activityPanel: ActivityPanel | null = null;

// Create managers with CRDT callbacks
const screenShare = new ScreenShareManager(
  state,
  (shareId, x, y) => crdt?.updateScreenSharePosition(shareId, x, y),
  (shareId, width, height) => crdt?.updateScreenShareSize(shareId, width, height),
  (shareId) => mediaControls.stopScreenShare(shareId)
);

const textNote = new TextNoteManager(
  state,
  (noteId, x, y) => crdt?.updateTextNotePosition(noteId, x, y),
  (noteId, width, height) => crdt?.updateTextNoteSize(noteId, width, height),
  (noteId, content) => crdt?.updateTextNoteContent(noteId, content),
  (noteId, fontSize, fontFamily, color) => crdt?.updateTextNoteStyle(noteId, fontSize, fontFamily, color),
  (noteId) => mediaControls.removeTextNote(noteId)
);

// Create MediaControls with lazy UI getter
const mediaControls = new MediaControls({
  state,
  socket,
  avatars,
  screenShare,
  textNote,
  ui: { 
    updateMicButton: (muted: boolean) => ui?.updateMicButton(muted),
    updateCameraButton: (off: boolean) => ui?.updateCameraButton(off),
    updateScreenButton: (sharing: boolean) => ui?.updateScreenButton(sharing),
    resetButtons: () => ui?.resetButtons(),
  } as any,
  getCRDT: () => crdt,
  getWebRTC: () => webrtc,
});

// ==================== Socket Event Handlers ====================

function handleConnectionStateChange(connectionState: ConnectionState, info?: ReconnectInfo): void {
  switch (connectionState) {
    case 'disconnected':
      setConnectionState('disconnected');
      ui?.showDisconnected();
      break;
    case 'reconnecting':
      setConnectionState('reconnecting');
      if (info) {
        setReconnectAttempt(info.attempt);
        ui?.showReconnecting(info.attempt, info.maxAttempts);
      }
      break;
    case 'connected':
      setConnectionState('connected');
      ui?.showConnected();
      break;
  }
}

// ==================== Preview Socket for Space Info ====================

let previewSocket: SocketHandler | null = null;

async function querySpaceInfo(spaceId: string): Promise<void> {
  setJoinParticipants({ type: 'loading' });
  previewSocket = new SocketHandler();

  previewSocket.on('space-info', (data: SpaceInfoEvent) => {
    if (!data.exists) {
      setJoinError(`Space "${spaceId}" doesn't exist. An admin needs to create it first.`);
      setJoinParticipants({ type: 'empty' });
    } else if (data.participants.length === 0) {
      setJoinParticipants({ type: 'empty' });
    } else {
      setJoinParticipants({ type: 'loaded', names: data.participants });
    }
    previewSocket?.disconnect();
    previewSocket = null;
  });

  try {
    await previewSocket.connect();
    previewSocket.emit('get-space-info', { spaceId });
  } catch (error) {
    console.error('Failed to query space info:', error);
    setJoinParticipants({ type: 'empty' });
  }
}

// ==================== Space Session Handlers ====================

async function handleJoinSpace(spaceId: string, username: string): Promise<void> {
  state.username = username;
  state.spaceId = spaceId;
  setSpaceName(spaceId);
  
  try {
    // Get media stream first (camera + mic)
    const constraints: MediaStreamConstraints = {
      video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
      audio: true,
    };
    
    try {
      state.localStream = await navigator.mediaDevices.getUserMedia(constraints);
    } catch (mediaError) {
      const err = mediaError as DOMException;
      console.error('getUserMedia error:', err.name, err.message);
      
      if (err.name === 'OverconstrainedError') {
        // Retry with basic constraints
        state.localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      } else {
        setJoinError(`Camera/microphone error: ${err.name}. Please grant permission and try again.`);
        return;
      }
    }
    
    // Update route to show space UI
    setRoute({ type: 'space', spaceId });
    
    // Wait a tick for SolidJS to render the DOM
    await new Promise((resolve) => setTimeout(resolve, 0));
    
    // Initialize DOM-dependent modules
    initializeSpaceModules();
    
    // Create WebRTC manager
    webrtc = new WebRTCManager(socket, state);
    await webrtc.init();
    webrtc.setManagers(avatars, screenShare, spatialAudio);
    
    // Create CRDT manager
    crdt = new CRDTManager(spaceId);
    
    // Connect socket
    await socket.connect();
    socket.emit('join-space', { username, spaceId });
    
  } catch (error) {
    console.error('Failed to join space:', error);
    setJoinError('Failed to connect. Please try again.');
    setRoute({ type: 'join', spaceId });
  }
}

function initializeSpaceModules(): void {
  // Initialize canvas manager (needs #canvas-container and #space)
  canvas = new CanvasManager();
  canvas.init();
  
  // Initialize minimap
  minimap = new MinimapManager(canvas, 4000, 4000);
  minimap.init();
  
  // Initialize UI controller (needs control buttons)
  ui = new UIController(state);
  
  // Initialize activity panel (needs #activity-panel, #btn-activity, #activity-badge)
  activityPanel = new ActivityPanel();
}

function handleLeaveSpace(): void {
  socket.disconnect();
  webrtc?.closeAllConnections();
  webrtc = null;
  crdt = null;
  ui = null;
  canvas = null;
  minimap = null;
  clearParticipants();
  setRoute({ type: 'landing' });
}

function handleToggleScreen(): void {
  mediaControls.startScreenShare();
}

function handleAddNote(): void {
  mediaControls.createTextNote();
}

// ==================== Socket Event Setup ====================

function setupSocketEvents(): void {
  socket.on('connected', (data) => {
    console.log('Connected with peer ID:', data.peerId);
    state.peerId = data.peerId;
    setPeerId(data.peerId);
    
    // Create local avatar at center of canvas
    const centerX = 2000;
    const centerY = 2000;
    
    if (state.localStream) {
      avatars.createLocalAvatar(state.peerId, state.username, state.localStream, centerX, centerY);
    }
    
    // Add self to CRDT
    crdt?.addPeer(state.peerId, state.username, centerX, centerY);
    
    // Set up position change handlers
    avatars.onPositionChange((peerId, x, y) => {
      crdt?.updatePosition(peerId, x, y);
      spatialAudio.updatePositions(avatars.getPositions(), state.peerId!);
    });
    
    avatars.onStatusChange((newStatus) => {
      state.status = newStatus;
      avatars.updateStatus(state.peerId!, newStatus);
      crdt?.updateStatus(state.peerId!, newStatus);
    });
    
    // Center canvas on avatar
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        canvas?.centerOn(centerX, centerY);
      });
    });
    
    // Update document title
    document.title = `${state.spaceId} - OpenSpatial`;
  });

  socket.on('peer-joined', (data) => {
    console.log('Peer joined:', data.peerId);
    addActivity({ type: 'join', username: data.username, timestamp: new Date() });
  });

  socket.on('peer-left', (data) => {
    console.log('Peer left:', data.peerId);
    removeParticipant(data.peerId);
    addActivity({ type: 'leave', username: 'User', timestamp: new Date() });
  });

  socket.on('space-activity', (data) => {
    activityPanel?.update(data.events);
  });

  socket.onConnectionStateChange(handleConnectionStateChange);
}

// ==================== Route Handling ====================

function handleInitialRoute(): void {
  const pathMatch = window.location.pathname.match(/^\/s\/(.+)$/);
  if (pathMatch) {
    const spaceId = decodeURIComponent(pathMatch[1]);
    document.title = `${spaceId} - OpenSpatial`;
    setRoute({ type: 'join', spaceId });
    querySpaceInfo(spaceId);
  } else {
    setRoute({ type: 'landing' });
  }
}

// ==================== Initialization ====================

function init(): void {
  checkBrowser();
  setupSocketEvents();
  handleInitialRoute();

  // Render SolidJS app
  const root = document.getElementById('app');
  if (root) {
    render(() => (
      <App
        onJoinSpace={handleJoinSpace}
        onLeaveSpace={handleLeaveSpace}
        onToggleScreen={handleToggleScreen}
        onAddNote={handleAddNote}
      />
    ), root);
  }
}

document.body.classList.add('loaded');
init();

// Export for modules that need direct access
export { avatars, screenShare, spatialAudio };

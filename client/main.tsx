/**
 * OpenSpatial Client Entry Point
 * SolidJS-based application with fine-grained reactivity.
 */
import './index.css';
import { render } from 'solid-js/web';
import { App } from './components/App';
import { 
  route, setRoute, 
  setSpaceName, setJoinParticipants, setJoinError,
  setConnectionState, setReconnectAttempt,
  addParticipant, updateParticipant, removeParticipant, clearParticipants,
  addScreenShare, updateScreenShare, removeScreenShare,
  addTextNote, updateTextNote, removeTextNote,
  addActivity,
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
import { SpaceSession } from './modules/space-session.js';
import { ActivityPanel } from './modules/activity-panel.js';
import type { SpaceInfoEvent, PeerData } from '../shared/types/events.js';
import type { AppState, PendingShareInfo } from '../shared/types/state.js';

// ==================== Application State (legacy bridge) ====================

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

const socket = new SocketHandler();
const canvas = new CanvasManager();
const avatars = new AvatarManager(state);
const spatialAudio = new SpatialAudio();
spatialAudio.setAvatarManager(avatars);

// Create placeholder managers
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

// Create MediaControls (needs special handling for circular dependency)
const mediaControls = new MediaControls({
  state,
  socket,
  avatars,
  screenShare,
  textNote,
  ui: null as any, // Will be unused with SolidJS
  getCRDT: () => crdt,
  getWebRTC: () => webrtc,
});

const activityPanel = new ActivityPanel();

// ==================== Socket Event Handlers ====================

function handleConnectionStateChange(connectionState: ConnectionState, info?: ReconnectInfo): void {
  switch (connectionState) {
    case 'disconnected':
      setConnectionState('disconnected');
      break;
    case 'reconnecting':
      setConnectionState('reconnecting');
      if (info) {
        setReconnectAttempt(info.attempt);
      }
      break;
    case 'connected':
      setConnectionState('connected');
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
    // Create WebRTC manager
    webrtc = new WebRTCManager(socket, state);
    await webrtc.init();
    webrtc.setManagers(avatars, screenShare, spatialAudio);
    
    // Create CRDT manager
    crdt = new CRDTManager(spaceId);
    
    // Connect socket
    await socket.connect();
    socket.emit('join-space', { username, spaceId });
    
    // Update route
    setRoute({ type: 'space', spaceId });
  } catch (error) {
    console.error('Failed to join space:', error);
    setJoinError('Failed to connect. Please try again.');
  }
}

function handleLeaveSpace(): void {
  socket.disconnect();
  webrtc?.closeAllConnections();
  webrtc = null;
  crdt = null;
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
    activityPanel.update(data.events);
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
  canvas.init();

  const minimap = new MinimapManager(canvas, 4000, 4000);
  minimap.init();

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

// Export for modules
export { avatars, screenShare, spatialAudio };

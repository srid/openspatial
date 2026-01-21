/**
 * OpenSpatial Client Entry Point (Solid.js)
 * Bridges reactive UI components to existing domain modules.
 */
import { render } from 'solid-js/web';
import './index.css';
document.body.classList.add('loaded');

import { App } from './components/App';
import { ui, AppView, connection, ConnectionStatus, user, spaceInfo } from './stores/app';

// ==================== Module Imports ====================

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
import { MediaControls } from './modules/media-controls.js';
import { SpaceSession } from './modules/space-session.js';
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
let canvasInitialized = false;

const socket = new SocketHandler();
const canvas = new CanvasManager();
const avatars = new AvatarManager(state);
const spatialAudio = new SpatialAudio();
spatialAudio.setAvatarManager(avatars);
const uiController = new UIController(state);

// Create managers with CRDT/WebRTC accessors
const mediaControls = new MediaControls({
  state,
  socket,
  avatars,
  screenShare: null as unknown as ScreenShareManager,
  textNote: null as unknown as TextNoteManager,
  ui: uiController,
  getCRDT: () => crdt,
  getWebRTC: () => webrtc,
});

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

// Update mediaControls with actual instances
(mediaControls as unknown as { deps: { screenShare: ScreenShareManager; textNote: TextNoteManager } }).deps.screenShare = screenShare;
(mediaControls as unknown as { deps: { screenShare: ScreenShareManager; textNote: TextNoteManager } }).deps.textNote = textNote;

// ==================== Space Session ====================

// Create DOM handles via query at action-time (Late-Look Pattern)
const getDOMHandles = () => ({
  joinModal: document.getElementById('join-modal') as HTMLElement,
  canvasContainer: document.getElementById('canvas-container') as HTMLElement,
  joinForm: document.getElementById('join-form') as HTMLFormElement,
  usernameInput: document.getElementById('username') as HTMLInputElement,
  spaceIdInput: document.getElementById('space-id') as HTMLInputElement,
  joinError: document.getElementById('join-error') as HTMLElement,
});

// SpaceSession needs DOM handles - we'll create a proxy that fetches lazily
const spaceSession = new SpaceSession(
  {
    state,
    socket,
    canvas,
    avatars,
    screenShare,
    textNote,
    spatialAudio,
    ui: uiController,
    mediaControls,
    getCRDT: () => crdt,
    setCRDT: (c) => { crdt = c; },
    getWebRTC: () => webrtc,
    setWebRTC: (w) => { webrtc = w; },
    createWebRTC: async () => {
      const w = new WebRTCManager(socket, state);
      await w.init();
      w.setManagers(avatars, screenShare, spatialAudio);
      return w;
    },
    createCRDT: (spaceId) => new CRDTManager(spaceId),
  },
  // Lazy DOM lookup - SpaceSession will access these when needed
  {
    get joinModal() { return document.getElementById('join-modal') as HTMLElement; },
    get canvasContainer() { return document.getElementById('canvas-container') as HTMLElement; },
    get joinForm() { return document.getElementById('join-form') as HTMLFormElement; },
    get usernameInput() { return document.getElementById('username') as HTMLInputElement; },
    get spaceIdInput() { return document.getElementById('space-id') as HTMLInputElement; },
    get joinError() { return document.getElementById('join-error') as HTMLElement; },
  }
);

// ==================== Preview Socket ====================

let previewSocket: SocketHandler | null = null;
const STORAGE_KEY_USERNAME = 'openspatial-username';

async function querySpaceInfo(spaceId: string): Promise<void> {
  previewSocket = new SocketHandler();

  previewSocket.on('space-info', (data: SpaceInfoEvent) => {
    if (!data.exists) {
      spaceInfo.setExists(false);
      ui.setJoinError(`Space "${spaceId}" doesn't exist. An admin needs to create it first.`);
    } else {
      spaceInfo.setExists(true);
      spaceInfo.setParticipants(data.participants);
    }
    previewSocket?.disconnect();
    previewSocket = null;
  });

  try {
    await previewSocket.connect();
    previewSocket.emit('get-space-info', { spaceId });
  } catch (error) {
    console.error('Failed to query space info:', error);
    spaceInfo.setParticipants([]);
  }
}

// ==================== Connection State ====================

function handleConnectionStateChange(connectionState: ConnectionState, info?: ReconnectInfo): void {
  switch (connectionState) {
    case 'disconnected':
      connection.setStatus(ConnectionStatus.Disconnected);
      uiController.showDisconnected();
      break;
    case 'reconnecting':
      connection.setStatus(ConnectionStatus.Reconnecting);
      if (info) {
        connection.setReconnectInfo(info.attempt, info.maxAttempts);
        uiController.showReconnecting(info.attempt, info.maxAttempts);
      }
      break;
    case 'connected':
      connection.setStatus(ConnectionStatus.Connected);
      uiController.showConnected();
      break;
  }
}

// ==================== Module Bridge ====================

const moduleBridge = {
  handleEnterSpace: (spaceId: string) => {
    window.location.href = `/s/${encodeURIComponent(spaceId)}`;
  },
  
  handleJoin: (username: string) => {
    // Sync to store
    user.setUsername(username);
    localStorage.setItem(STORAGE_KEY_USERNAME, username);
    
    // Set the input values (SpaceSession reads from DOM)
    // Must set BOTH inputs explicitly - Solid reactivity may not have updated DOM yet
    const usernameInput = document.getElementById('username') as HTMLInputElement;
    const spaceIdInput = document.getElementById('space-id') as HTMLInputElement;
    if (usernameInput) usernameInput.value = username;
    if (spaceIdInput) spaceIdInput.value = user.spaceId();
    
    // Initiate join - view transition happens in 'connected' callback
    spaceSession.handleJoin(new Event('submit'));
  },
  
  toggleMic: () => {
    mediaControls.toggleMic();
    user.setIsMuted(!user.isMuted());
  },
  
  toggleCamera: () => {
    mediaControls.toggleCamera();
    user.setIsVideoOff(!user.isVideoOff());
  },
  
  shareScreen: () => {
    mediaControls.startScreenShare();
  },
  
  addNote: () => {
    mediaControls.createTextNote();
  },
  
  leaveSpace: () => {
    spaceSession.leaveSpace();
    // Stay on Join view so user can rejoin the same space
    ui.setCurrentView(AppView.Join);
  },
};

// ==================== Event Listeners ====================

function setupEventListeners(): void {
  socket.on('connected', (data) => {
    user.setPeerId(data.peerId);
    
    // Store previous peerId BEFORE updating, for reconnection detection
    const previousPeerId = state.peerId;
    
    // Set state.peerId IMMEDIATELY - this is required for WebRTC signaling
    // which may happen before requestAnimationFrame callback runs
    state.peerId = data.peerId;
    
    // Transition to space view BEFORE handleConnected
    // This renders #canvas-container and #space where avatars are created
    ui.setCurrentView(AppView.Space);
    
    // Initialize canvas modules (only once)
    if (!canvasInitialized) {
      canvasInitialized = true;
      // Use requestAnimationFrame to ensure Solid has rendered the DOM
      requestAnimationFrame(() => {
        canvas.init();
        const minimap = new MinimapManager(canvas, 4000, 4000);
        minimap.init();
        
        // Now that canvas is ready, handle the connected event (pass previousPeerId for reconnection detection)
        spaceSession.handleConnected(data, previousPeerId);
      });
    } else {
      spaceSession.handleConnected(data, previousPeerId);
    }
  });
  socket.on('peer-joined', (data) => spaceSession.handlePeerJoined(data));
  socket.on('peer-left', (data) => spaceSession.handlePeerLeft(data));
  socket.on('signal', (data) => spaceSession.handleSignal(data));
  socket.on('screen-share-started', (data) => spaceSession.handleScreenShareStarted(data));
  socket.on('screen-share-stopped', (data) => spaceSession.handleScreenShareStopped(data));
  socket.on('space-state', (data) => spaceSession.handleSpaceState(data));
  socket.on('reconnected', () => spaceSession.handleReconnected());

  socket.onConnectionStateChange(handleConnectionStateChange);

  window.addEventListener('offline', () => {
    console.log('Browser went offline');
    connection.setStatus(ConnectionStatus.Disconnected);
  });

  window.addEventListener('online', () => {
    console.log('Browser came back online');
    connection.setStatus(ConnectionStatus.Connected);
  });
}

// ==================== Initialization ====================

function init(): void {
  // Render Solid.js app
  const appRoot = document.getElementById('app-root');
  if (appRoot) {
    render(() => <App bridge={moduleBridge} />, appRoot);
  } else {
    console.error('No #app-root found');
    return;
  }

  setupEventListeners();
  // NOTE: canvas.init() and minimap.init() are deferred to handleJoin
  // because #canvas-container only exists when view is Space

  // Restore saved username
  const savedUsername = localStorage.getItem(STORAGE_KEY_USERNAME);
  if (savedUsername) {
    user.setUsername(savedUsername);
  }

  // Route based on URL
  const pathMatch = window.location.pathname.match(/^\/s\/(.+)$/);
  if (pathMatch) {
    const spaceId = decodeURIComponent(pathMatch[1]);
    user.setSpaceId(spaceId);
    spaceInfo.setName(spaceId);
    document.title = `${spaceId} - OpenSpatial`;
    
    ui.setCurrentView(AppView.Join);
    querySpaceInfo(spaceId);
  } else {
    ui.setCurrentView(AppView.Landing);
  }
}

// Start the app
init();

// Export for WebRTC module to access
export { avatars, screenShare, spatialAudio };

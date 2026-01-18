/**
 * OpenSpatial Client Entry Point (Solid.js)
 * 
 * This file bridges the new Solid.js UI components with the existing
 * module architecture (WebRTC, CRDT, Socket, etc.)
 */
import './index.css';
import { render } from 'solid-js/web';
import { App, setModuleBridge } from './App';
import { ui, user, media, connection, peersStore } from './stores/app';

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

// ==================== Application State (for existing modules) ====================

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
let previewSocket: SocketHandler | null = null;

const socket = new SocketHandler();
const canvas = new CanvasManager();
const avatars = new AvatarManager(state);
const spatialAudio = new SpatialAudio();
spatialAudio.setAvatarManager(avatars);
const uiController = new UIController(state);

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

// ==================== DOM Elements for SpaceSession ====================

// These are created dynamically when space view is shown
let joinModalEl: HTMLElement | null = null;
let canvasContainerEl: HTMLElement | null = null;
let joinFormEl: HTMLFormElement | null = null;
let usernameInputEl: HTMLInputElement | null = null;
let spaceIdInputEl: HTMLInputElement | null = null;
let joinErrorEl: HTMLElement | null = null;

// ==================== Space Session ====================

let spaceSession: SpaceSession;

function initSpaceSession() {
  joinModalEl = document.getElementById('join-modal');
  canvasContainerEl = document.getElementById('canvas-container');
  joinFormEl = document.getElementById('join-form') as HTMLFormElement;
  usernameInputEl = document.getElementById('username') as HTMLInputElement;
  spaceIdInputEl = document.getElementById('space-id') as HTMLInputElement;
  joinErrorEl = document.getElementById('join-error');

  // For Solid.js rendering, we create placeholder elements if they don't exist
  if (!joinModalEl) {
    joinModalEl = document.createElement('div');
    joinModalEl.id = 'join-modal';
  }
  if (!joinFormEl) {
    joinFormEl = document.createElement('form');
    joinFormEl.id = 'join-form';
  }
  if (!usernameInputEl) {
    usernameInputEl = document.createElement('input');
    usernameInputEl.id = 'username';
  }
  if (!spaceIdInputEl) {
    spaceIdInputEl = document.createElement('input');
    spaceIdInputEl.id = 'space-id';
  }
  if (!joinErrorEl) {
    joinErrorEl = document.createElement('div');
    joinErrorEl.id = 'join-error';
  }

  spaceSession = new SpaceSession(
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
      createWebRTC: () => {
        const w = new WebRTCManager(socket, state);
        w.setManagers(avatars, screenShare, spatialAudio);
        return w;
      },
      createCRDT: (spaceId) => new CRDTManager(spaceId),
    },
    {
      joinModal: joinModalEl!,
      canvasContainer: canvasContainerEl!,
      joinForm: joinFormEl!,
      usernameInput: usernameInputEl!,
      spaceIdInput: spaceIdInputEl!,
      joinError: joinErrorEl!,
    }
  );
}

// ==================== Store Sync ====================

// Sync state changes to Solid stores
function syncStatesToStores() {
  // State -> Stores sync happens via direct calls in handlers
  // This function can be called periodically if needed
}

// ==================== Query Space Info ====================

async function querySpaceInfo(spaceId: string): Promise<void> {
  previewSocket = new SocketHandler();
  ui.setIsLoadingParticipants(true);

  previewSocket.on('space-info', (data: SpaceInfoEvent) => {
    ui.setIsLoadingParticipants(false);
    if (!data.exists) {
      ui.setJoinError(`Space "${spaceId}" doesn't exist. An admin needs to create it first.`);
    } else {
      ui.setSpaceParticipants(data.participants);
      ui.setJoinError(null);
    }
    previewSocket?.disconnect();
    previewSocket = null;
  });

  try {
    await previewSocket.connect();
    previewSocket.emit('get-space-info', { spaceId });
  } catch (error) {
    console.error('Failed to query space info:', error);
    ui.setIsLoadingParticipants(false);
    ui.setJoinError('Unable to connect to server');
  }
}

// ==================== Connection State ====================

function handleConnectionStateChange(connectionState: ConnectionState, info?: ReconnectInfo): void {
  switch (connectionState) {
    case 'disconnected':
      connection.setStatus('disconnected');
      uiController.showDisconnected();
      break;
    case 'reconnecting':
      connection.setStatus('reconnecting');
      if (info) {
        connection.setReconnectInfo(info.attempt, info.maxAttempts);
        uiController.showReconnecting(info.attempt, info.maxAttempts);
      }
      break;
    case 'connected':
      connection.setStatus('connected');
      uiController.showConnected();
      break;
  }
}

// ==================== Module Bridge ====================

setModuleBridge({
  handleEnterSpace: (spaceName: string) => {
    window.location.href = `/s/${encodeURIComponent(spaceName)}`;
  },
  
  handleJoin: async (username: string) => {
    // Save username
    localStorage.setItem('openspatial-username', username);
    state.username = username;
    user.setUsername(username);

    // Set up spaceId input for SpaceSession
    if (spaceIdInputEl) {
      spaceIdInputEl.value = user.spaceId();
    }
    if (usernameInputEl) {
      usernameInputEl.value = username;
    }

    // Create a synthetic form submit event
    const event = new Event('submit', { cancelable: true });
    spaceSession.handleJoin(event);

    // Switch to space view
    ui.setCurrentView('space');
  },
  
  handleBack: () => {
    window.location.href = '/';
  },
  
  toggleMic: () => {
    mediaControls.toggleMic();
    media.setIsMuted(state.isMuted);
  },
  
  toggleCamera: () => {
    mediaControls.toggleCamera();
    media.setIsVideoOff(state.isVideoOff);
  },
  
  startScreenShare: () => {
    mediaControls.startScreenShare();
  },
  
  createTextNote: () => {
    mediaControls.createTextNote();
  },
  
  leaveSpace: () => {
    spaceSession.leaveSpace();
    ui.setCurrentView('landing');
  },
  
  querySpaceInfo,
});

// ==================== Event Listeners ====================

function setupEventListeners(): void {
  socket.on('connected', (data) => spaceSession?.handleConnected(data));
  socket.on('peer-joined', (data) => spaceSession?.handlePeerJoined(data));
  socket.on('peer-left', (data) => spaceSession?.handlePeerLeft(data));
  socket.on('signal', (data) => spaceSession?.handleSignal(data));
  socket.on('screen-share-started', (data) => spaceSession?.handleScreenShareStarted(data));
  socket.on('screen-share-stopped', (data) => spaceSession?.handleScreenShareStopped(data));
  socket.on('space-state', (data) => spaceSession?.handleSpaceState(data));
  socket.on('reconnected', () => spaceSession?.handleReconnected());

  socket.onConnectionStateChange(handleConnectionStateChange);

  window.addEventListener('offline', () => {
    console.log('Browser went offline');
    connection.setStatus('disconnected');
    uiController.showDisconnected();
  });

  window.addEventListener('online', () => {
    console.log('Browser came back online');
    connection.setStatus('connected');
    uiController.showConnected();
  });
}

// ==================== Initialization ====================

function init(): void {
  // Render Solid app
  const root = document.getElementById('app-root');
  if (root) {
    render(() => <App />, root);
  }

  // Initialize existing modules
  initSpaceSession();
  setupEventListeners();
  canvas.init();

  const minimap = new MinimapManager(canvas, 4000, 4000);
  minimap.init();

  // Mark body as loaded
  document.body.classList.add('loaded');
}

// Start the app when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

// Export for WebRTC module to access
export { avatars, screenShare, spatialAudio };

/**
 * OpenSpatial Client Entry Point
 * Minimal orchestration layer that wires modules together.
 */
import './index.css';
document.body.classList.add('loaded');

import { checkBrowser } from './modules/browser-check.js';
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
import { ActivityPanel } from './modules/activity-panel.js';
import type { SpaceInfoEvent } from '../shared/types/events.js';
import type { AppState, PendingShareInfo } from '../shared/types/state.js';
import type { PeerData } from '../shared/types/events.js';

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

const socket = new SocketHandler();
const canvas = new CanvasManager();
const avatars = new AvatarManager(state);
const spatialAudio = new SpatialAudio();
spatialAudio.setAvatarManager(avatars);
const ui = new UIController(state);
const activityPanel = new ActivityPanel();

// Create managers with CRDT/WebRTC accessors
const mediaControls = new MediaControls({
  state,
  socket,
  avatars,
  screenShare: null as unknown as ScreenShareManager, // Will be set after init
  textNote: null as unknown as TextNoteManager,
  ui,
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

// ==================== DOM Elements ====================

const landingPage = document.getElementById('landing-page') as HTMLElement;
const joinModal = document.getElementById('join-modal') as HTMLElement;
const joinForm = document.getElementById('join-form') as HTMLFormElement;
const canvasContainer = document.getElementById('canvas-container') as HTMLElement;
const usernameInput = document.getElementById('username') as HTMLInputElement;
const spaceIdInput = document.getElementById('space-id') as HTMLInputElement;
const spaceNameLabel = document.getElementById('space-name-label') as HTMLElement;
const spaceParticipants = document.getElementById('space-participants') as HTMLElement;
const joinError = document.getElementById('join-error') as HTMLElement;

// ==================== Space Session ====================

const spaceSession = new SpaceSession(
  {
    state,
    socket,
    canvas,
    avatars,
    screenShare,
    textNote,
    spatialAudio,
    ui,
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
  {
    joinModal,
    canvasContainer,
    joinForm,
    usernameInput,
    spaceIdInput,
    joinError,
  }
);

// ==================== Preview Socket ====================

let previewSocket: SocketHandler | null = null;
const STORAGE_KEY_USERNAME = 'openspatial-username';

async function querySpaceInfo(spaceId: string): Promise<void> {
  previewSocket = new SocketHandler();

  previewSocket.on('space-info', (data: SpaceInfoEvent) => {
    if (!data.exists) {
      showSpaceNotFoundError(spaceId);
    } else {
      displaySpaceParticipants(data.participants);
    }
    previewSocket?.disconnect();
    previewSocket = null;
  });

  try {
    await previewSocket.connect();
    previewSocket.emit('get-space-info', { spaceId });
  } catch (error) {
    console.error('Failed to query space info:', error);
    spaceParticipants.innerHTML = '<span>Unable to check participants</span>';
  }
}

function showSpaceNotFoundError(spaceId: string): void {
  spaceParticipants.innerHTML = '';
  joinError.innerHTML = `
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <circle cx="12" cy="12" r="10"></circle>
      <line x1="12" y1="8" x2="12" y2="12"></line>
      <line x1="12" y1="16" x2="12.01" y2="16"></line>
    </svg>
    <span>Space "${spaceId}" doesn't exist. An admin needs to create it first.</span>
  `;
  joinError.classList.remove('hidden');

  const submitButton = joinForm.querySelector('button[type="submit"]') as HTMLButtonElement;
  if (submitButton) {
    submitButton.disabled = true;
  }
}

function displaySpaceParticipants(participants: string[]): void {
  if (participants.length === 0) {
    spaceParticipants.innerHTML = '<span>No one here yet — be the first!</span>';
  } else {
    const names = participants.map((name) => `<span class="participant-name">${name}</span>`).join('');
    const label = participants.length === 1 ? 'Here now:' : `${participants.length} people here:`;
    spaceParticipants.innerHTML = `
      <span>${label}</span>
      <div class="participant-list">${names}</div>
    `;
  }
}

// ==================== Connection State ====================

function handleConnectionStateChange(connectionState: ConnectionState, info?: ReconnectInfo): void {
  switch (connectionState) {
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

// ==================== Event Listeners ====================

function setupEventListeners(): void {
  joinForm.addEventListener('submit', (e) => spaceSession.handleJoin(e));

  const landingSpaceForm = document.getElementById('landing-space-form');
  if (landingSpaceForm) {
    landingSpaceForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const input = document.getElementById('landing-space-input') as HTMLInputElement;
      const spaceName = input.value.trim() || 'demo';
      window.location.href = `/s/${encodeURIComponent(spaceName)}`;
    });
  }

  document.getElementById('btn-mic')!.addEventListener('click', () => mediaControls.toggleMic());
  document.getElementById('btn-camera')!.addEventListener('click', () => mediaControls.toggleCamera());
  document.getElementById('btn-screen')!.addEventListener('click', () => mediaControls.startScreenShare());
  document.getElementById('btn-note')!.addEventListener('click', () => mediaControls.createTextNote());
  document.getElementById('btn-leave')!.addEventListener('click', () => spaceSession.leaveSpace());

  socket.on('connected', (data) => spaceSession.handleConnected(data));
  socket.on('peer-joined', (data) => spaceSession.handlePeerJoined(data));
  socket.on('peer-left', (data) => spaceSession.handlePeerLeft(data));
  socket.on('signal', (data) => spaceSession.handleSignal(data));
  socket.on('screen-share-started', (data) => spaceSession.handleScreenShareStarted(data));
  socket.on('screen-share-stopped', (data) => spaceSession.handleScreenShareStopped(data));
  socket.on('space-state', (data) => spaceSession.handleSpaceState(data));
  socket.on('space-activity', (data) => {
    activityPanel.update(data.events);
  });
  socket.on('reconnected', () => spaceSession.handleReconnected());

  socket.onConnectionStateChange(handleConnectionStateChange);

  window.addEventListener('offline', () => {
    console.log('Browser went offline');
    ui.showDisconnected();
  });

  window.addEventListener('online', () => {
    console.log('Browser came back online');
    ui.showConnected();
  });
}

// ==================== Initialization ====================

function init(): void {
  checkBrowser();
  setupEventListeners();
  canvas.init();

  const minimap = new MinimapManager(canvas, 4000, 4000);
  minimap.init();

  const savedUsername = localStorage.getItem(STORAGE_KEY_USERNAME);
  if (savedUsername) {
    usernameInput.value = savedUsername;
  }

  const pathMatch = window.location.pathname.match(/^\/s\/(.+)$/);
  if (pathMatch) {
    const spaceId = decodeURIComponent(pathMatch[1]);
    spaceIdInput.value = spaceId;
    document.title = `${spaceId} - OpenSpatial`;
    spaceNameLabel.textContent = spaceId;

    landingPage.classList.add('hidden');
    joinModal.classList.remove('hidden');
    usernameInput.focus();

    querySpaceInfo(spaceId);
  } else {
    landingPage.classList.remove('hidden');
    joinModal.classList.add('hidden');
  }
}

// Start the app
init();

// Export for WebRTC module to access
export { avatars, screenShare, spatialAudio };

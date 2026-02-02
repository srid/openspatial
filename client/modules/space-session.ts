/**
 * Space Session Module
 * Handles joining, leaving, reconnection, and peer/CRDT state synchronization.
 */

import type { CRDTManager } from './crdt.js';
import type { WebRTCManager } from './webrtc.js';
import type { AvatarManager } from './avatar.js';
import type { ScreenShareManager } from './screenshare.js';
import type { TextNoteManager } from './textnote.js';
import type { SpatialAudio } from './spatial-audio.js';
import type { UIController } from './ui.js';
import type { CanvasManager } from './canvas.js';
import type { SocketHandler } from './socket.js';
import type { MediaControls } from './media-controls.js';
import { playJoinSound, playLeaveSound } from './notifications.js';
import { updateBackgroundTune, stopBackgroundTune } from './background-tune.js';
import type { AppState } from '../../shared/types/state.js';
import type {
  ConnectedEvent,
  SpaceStateEvent,
  PeerJoinedEvent,
  PeerLeftEvent,
  SignalEvent,
  ScreenShareStartedBroadcast,
  ScreenShareStoppedBroadcast,
} from '../../shared/types/events.js';

/**
 * Dependencies required by SpaceSession.
 */
export interface SpaceSessionDeps {
  state: AppState;
  socket: SocketHandler;
  canvas: CanvasManager;
  avatars: AvatarManager;
  screenShare: ScreenShareManager;
  textNote: TextNoteManager;
  spatialAudio: SpatialAudio;
  ui: UIController;
  mediaControls: MediaControls;
  getCRDT: () => CRDTManager | null;
  setCRDT: (crdt: CRDTManager | null) => void;
  getWebRTC: () => WebRTCManager | null;
  setWebRTC: (webrtc: WebRTCManager) => void;
  createWebRTC: () => Promise<WebRTCManager>;
  createCRDT: (spaceId: string) => CRDTManager;
}

/**
 * DOM element references for the session UI.
 */
interface DOMElements {
  joinModal: HTMLElement;
  canvasContainer: HTMLElement;
  joinForm: HTMLFormElement;
  usernameInput: HTMLInputElement;
  spaceIdInput: HTMLInputElement;
  joinError: HTMLElement;
}

/**
 * SpaceSession manages the lifecycle of joining and leaving a space.
 */
export class SpaceSession {
  private deps: SpaceSessionDeps;
  private dom: DOMElements;
  private existingNoteIds = new Set<string>();

  private static readonly STORAGE_KEY_USERNAME = 'openspatial-username';

  constructor(deps: SpaceSessionDeps, dom: DOMElements) {
    this.deps = deps;
    this.dom = dom;
  }

  /**
   * Handle join form submission.
   */
  async handleJoin(e: Event): Promise<void> {
    e.preventDefault();
    this.hideJoinError();

    const { state, socket } = this.deps;
    const { usernameInput, spaceIdInput } = this.dom;

    state.username = usernameInput.value.trim();
    state.spaceId = spaceIdInput.value.trim();

    if (!state.username || !state.spaceId) return;

    localStorage.setItem(SpaceSession.STORAGE_KEY_USERNAME, state.username);

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
          this.showJoinError('Camera/microphone access was denied. Please grant permission and try again.');
        } else if (err.name === 'NotFoundError') {
          this.showJoinError('No camera or microphone found on this device.');
        } else if (err.name === 'NotReadableError') {
          this.showJoinError('Camera/microphone is already in use by another application.');
        } else if (err.name === 'OverconstrainedError') {
          console.log('Retrying with basic constraints...');
          state.localStream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: true,
          });
        } else {
          this.showJoinError(`Camera/microphone error: ${err.name}`);
        }

        if (!state.localStream) return;
      }

      const webrtc = await this.deps.createWebRTC();
      this.deps.setWebRTC(webrtc);

      await socket.connect();

      socket.emit('join-space', {
        spaceId: state.spaceId,
        username: state.username,
      });
    } catch (error) {
      const err = error as Error;
      console.error('Failed to join:', err);
      this.showJoinError(`Failed to connect: ${err.message}`);
    }
  }

  /**
   * Handle successful connection (first join or reconnection).
   */
  handleConnected(data: ConnectedEvent): void {
    const { state, canvas, avatars, spatialAudio } = this.deps;
    const previousPeerId = state.peerId;
    const isReconnection = previousPeerId !== null;

    state.peerId = data.peerId;

    if (isReconnection) {
      this.handleReconnection(previousPeerId, data.peerId);
      return;
    }

    // First-time join
    this.dom.joinModal.classList.add('hidden');
    this.dom.canvasContainer.classList.remove('hidden');

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

    // Initialize CRDT
    const crdt = this.deps.createCRDT(state.spaceId);
    this.deps.setCRDT(crdt);
    crdt.addPeer(state.peerId, state.username, centerX, centerY);
    this.setupCRDTObservers();

    avatars.onPositionChange((peerId, x, y) => {
      this.deps.getCRDT()?.updatePosition(peerId, x, y);
      spatialAudio.updatePositions(avatars.getPositions(), state.peerId!);
    });

    avatars.onStatusChange((newStatus) => {
      state.status = newStatus;
      avatars.updateStatus(state.peerId!, newStatus);
      this.deps.getCRDT()?.updateStatus(state.peerId!, newStatus);
    });

    this.updateParticipantCount();
  }

  private handleReconnection(previousPeerId: string, newPeerId: string): void {
    const { state, avatars } = this.deps;
    const webrtc = this.deps.getWebRTC();

    console.log(`Reconnected with new peerId: ${newPeerId} (was: ${previousPeerId})`);

    avatars.updateLocalPeerId(previousPeerId, newPeerId);
    state.peers.clear();
    webrtc?.closeAllConnections();

    this.deps.getCRDT()?.destroy();
    const crdt = this.deps.createCRDT(state.spaceId);
    this.deps.setCRDT(crdt);
    this.setupCRDTObservers();

    this.updateParticipantCount();
  }

  /**
   * Handle socket reconnection event.
   */
  handleReconnected(): void {
    const { state, socket, ui } = this.deps;
    console.log('Reconnected - rejoining space');
    ui.showConnected();

    if (state.spaceId && state.username) {
      socket.emit('join-space', {
        spaceId: state.spaceId,
        username: state.username,
      });
    }
  }

  /**
   * Handle initial space state from server.
   */
  handleSpaceState(spaceState: SpaceStateEvent): void {
    const { state, canvas, avatars } = this.deps;
    const crdt = this.deps.getCRDT();
    const webrtc = this.deps.getWebRTC();

    for (const [peerId, peerData] of Object.entries(spaceState.peers)) {
      if (peerId === state.peerId) {
        avatars.setPosition(peerId, peerData.position.x, peerData.position.y);
        canvas.centerOn(peerData.position.x, peerData.position.y);
        crdt?.updatePosition(peerId, peerData.position.x, peerData.position.y);
      } else {
        state.peers.set(peerId, peerData);
        avatars.createRemoteAvatar(peerId, peerData.username, peerData.position.x, peerData.position.y);

        if (peerData.status) {
          avatars.updateStatus(peerId, peerData.status);
        }

        webrtc!.createPeerConnection(peerId, true);
      }
    }

    this.updateParticipantCount();
  }

  /**
   * Handle peer joined event.
   */
  handlePeerJoined(data: PeerJoinedEvent): void {
    const { state, avatars } = this.deps;
    const { peerId, username, position } = data;

    state.peers.set(peerId, { username, position, isMuted: false, isVideoOff: false, isScreenSharing: false });
    avatars.createRemoteAvatar(peerId, username, position.x, position.y);

    if (state.screenStreams.size > 0) {
      const webrtc = this.deps.getWebRTC();
      webrtc?.createPeerConnection(peerId, true);
    }

    this.updateParticipantCount();
    playJoinSound();
  }

  /**
   * Handle peer left event.
   */
  handlePeerLeft(data: PeerLeftEvent): void {
    const { state, avatars, screenShare, spatialAudio } = this.deps;
    const { peerId } = data;

    state.peers.delete(peerId);
    avatars.removeAvatar(peerId);
    screenShare.removeScreenSharesByPeerId(peerId);
    spatialAudio.removePeer(peerId);
    this.deps.getWebRTC()?.closePeerConnection(peerId);

    this.updateParticipantCount();
    playLeaveSound();
  }

  /**
   * Handle WebRTC signal.
   */
  handleSignal(data: SignalEvent): void {
    this.deps.getWebRTC()?.handleSignal(data);
  }

  /**
   * Handle screen share started broadcast.
   */
  handleScreenShareStarted(data: ScreenShareStartedBroadcast): void {
    const { state } = this.deps;
    const { peerId, shareId } = data;

    if (!state.pendingShareIds.has(peerId)) {
      state.pendingShareIds.set(peerId, []);
    }
    state.pendingShareIds.get(peerId)!.push(shareId);
  }

  /**
   * Handle screen share stopped broadcast.
   */
  handleScreenShareStopped(data: ScreenShareStoppedBroadcast): void {
    const { screenShare } = this.deps;
    const crdt = this.deps.getCRDT();
    const { shareId } = data;

    screenShare.removeScreenShare(shareId);
    crdt?.removeScreenShare(shareId);
  }

  /**
   * Leave the current space and clean up all state.
   */
  leaveSpace(): void {
    const { state, socket, avatars, screenShare, textNote, ui } = this.deps;
    const crdt = this.deps.getCRDT();
    const webrtc = this.deps.getWebRTC();

    if (state.localStream) {
      state.localStream.getTracks().forEach((track) => track.stop());
    }
    state.screenStreams.forEach((stream) => {
      stream.getTracks().forEach((track) => track.stop());
    });

    if (state.peerId) {
      crdt?.removePeer(state.peerId);
    }
    crdt?.destroy();
    this.deps.setCRDT(null);

    webrtc?.closeAllConnections();
    socket.disconnect();

    avatars.clear();
    screenShare.clear();
    textNote.clear();
    this.existingNoteIds.clear();

    state.peers.clear();
    state.localStream = null;
    state.screenStreams.clear();
    state.peerId = null;
    state.isMuted = false;
    state.isVideoOff = false;

    document.title = 'OpenSpatial - Virtual Office';

    this.dom.canvasContainer.classList.add('hidden');
    this.dom.joinModal.classList.remove('hidden');

    ui.resetButtons();
    stopBackgroundTune();
  }

  /**
   * Set up CRDT observers for remote state changes.
   */
  private setupCRDTObservers(): void {
    const crdt = this.deps.getCRDT();
    if (!crdt) return;

    const { state, avatars, screenShare, textNote, spatialAudio } = this.deps;

    // Observe peer state changes
    crdt.observePeers((peers) => {
      for (const [peerId, peerState] of peers) {
        if (peerId === state.peerId) continue;

        if (!avatars.hasAvatar(peerId)) {
          console.log(`[CRDT] Creating avatar for ${peerId} from CRDT data`);
          state.peers.set(peerId, {
            username: peerState.username,
            position: { x: peerState.x, y: peerState.y },
            isMuted: peerState.isMuted,
            isVideoOff: peerState.isVideoOff,
            isScreenSharing: false,
          });
          avatars.createRemoteAvatar(peerId, peerState.username, peerState.x, peerState.y);
          this.updateParticipantCount();

          if (state.localStream) {
            this.deps.getWebRTC()?.createPeerConnection(peerId, true);
          }
        }

        avatars.updatePosition(peerId, peerState.x, peerState.y);
        avatars.updateMediaState(peerId, peerState.isMuted, peerState.isVideoOff);
        avatars.updateStatus(peerId, peerState.status);
      }
      spatialAudio.updatePositions(avatars.getPositions(), state.peerId!);
    });

    // Observe screen share state changes (anyone can move/resize any share)
    crdt.observeScreenShares((shares) => {
      for (const [shareId, shareState] of shares) {
        screenShare.setPosition(shareId, shareState.x, shareState.y);
        screenShare.setSize(shareId, shareState.width, shareState.height);
      }
    });

    // Observe text note state changes
    crdt.observeTextNotes((notes) => {
      const crdtNoteIds = new Set(notes.keys());

      for (const noteId of this.existingNoteIds) {
        if (!crdtNoteIds.has(noteId)) {
          textNote.removeTextNote(noteId);
          this.existingNoteIds.delete(noteId);
        }
      }

      for (const [noteId, noteState] of notes) {
        if (!this.existingNoteIds.has(noteId)) {
          textNote.createTextNote(
            noteId,
            noteState.content,
            noteState.x,
            noteState.y,
            noteState.width,
            noteState.height,
            noteState.fontSize,
            noteState.fontFamily,
            noteState.color
          );
          this.existingNoteIds.add(noteId);
        } else {
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

  private showJoinError(message: string): void {
    this.dom.joinError.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="10"></circle>
        <line x1="12" y1="8" x2="12" y2="12"></line>
        <line x1="12" y1="16" x2="12.01" y2="16"></line>
      </svg>
      <span>${message}</span>
    `;
    this.dom.joinError.classList.remove('hidden');
  }

  private hideJoinError(): void {
    this.dom.joinError.classList.add('hidden');
  }

  private updateParticipantCount(): void {
    const count = this.deps.state.peers.size + 1;
    document.getElementById('participant-count')!.textContent = `${count} participant${count !== 1 ? 's' : ''}`;
    updateBackgroundTune(count);
  }
}

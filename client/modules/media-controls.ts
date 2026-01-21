/**
 * Media Controls Module
 * Handles microphone, camera, screen sharing, and text note controls.
 */

import type { CRDTManager } from './crdt.js';
import type { WebRTCManager } from './webrtc.js';
import type { AvatarManager } from './avatar.js';
import type { ScreenShareManager } from './screenshare.js';
import type { TextNoteManager } from './textnote.js';
import type { UIController } from './ui.js';
import type { SocketHandler } from './socket.js';
import type { AppState } from '../../shared/types/state.js';

/**
 * Dependencies required by MediaControls.
 * screenShare and textNote are optional at construction time to avoid circular dependencies.
 */
export interface MediaControlsDeps {
  state: AppState;
  socket: SocketHandler;
  avatars: AvatarManager;
  screenShare?: ScreenShareManager;
  textNote?: TextNoteManager;
  ui: UIController;
  getCRDT: () => CRDTManager | null;
  getWebRTC: () => WebRTCManager | null;
}

/**
 * MediaControls handles local media toggles and screen/note creation.
 */
export class MediaControls {
  private deps: MediaControlsDeps;

  constructor(deps: MediaControlsDeps) {
    this.deps = deps;
  }

  /** Set screen share manager (for deferred initialization). */
  setScreenShare(screenShare: ScreenShareManager): void {
    this.deps.screenShare = screenShare;
  }

  /** Set text note manager (for deferred initialization). */
  setTextNote(textNote: TextNoteManager): void {
    this.deps.textNote = textNote;
  }

  /**
   * Toggle local microphone on/off.
   */
  toggleMic(): void {
    const { state, ui, avatars } = this.deps;
    const crdt = this.deps.getCRDT();

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

  /**
   * Toggle local camera on/off.
   */
  toggleCamera(): void {
    const { state, ui, avatars } = this.deps;
    const crdt = this.deps.getCRDT();

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

  /**
   * Start sharing screen. User will be prompted to select a screen/window.
   */
  async startScreenShare(): Promise<void> {
    const { state, avatars, screenShare, socket } = this.deps;
    const crdt = this.deps.getCRDT();
    const webrtc = this.deps.getWebRTC();

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

      screenShare?.createScreenShare(shareId, state.peerId!, state.username, stream, x, y);
      webrtc?.addScreenTrack(shareId, stream);

      // Add to CRDT for sync
      crdt?.addScreenShare(shareId, state.peerId!, state.username, x, y, width, height);

      // Socket needed for WebRTC track signaling
      socket.emit('screen-share-started', { peerId: state.peerId!, shareId });

      stream.getVideoTracks()[0].onended = () => {
        this.stopScreenShare(shareId);
      };
    } catch (error) {
      const err = error as Error;
      if (err.name !== 'NotAllowedError') {
        console.error('Screen share failed:', err);
      }
    }
  }

  /**
   * Stop a specific screen share by its ID.
   */
  stopScreenShare(shareId: string): void {
    const { state, screenShare, socket } = this.deps;
    const crdt = this.deps.getCRDT();
    const webrtc = this.deps.getWebRTC();

    const stream = state.screenStreams.get(shareId);
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      state.screenStreams.delete(shareId);
    }

    screenShare?.removeScreenShare(shareId);
    webrtc?.removeScreenTrack(shareId);
    crdt?.removeScreenShare(shareId);

    // Socket needed for WebRTC track cleanup signaling
    socket.emit('screen-share-stopped', { peerId: state.peerId!, shareId });
  }

  /**
   * Create a new text note near the local avatar.
   */
  createTextNote(): void {
    const { state, avatars } = this.deps;
    const crdt = this.deps.getCRDT();

    console.log('[MediaControls] createTextNote called', { peerId: state.peerId, hasCRDT: !!crdt });

    if (!state.peerId) {
      console.log('[MediaControls] No peerId, returning early');
      return;
    }

    const noteId = `${state.peerId}-note-${Date.now()}`;
    const localPos = avatars.getPosition(state.peerId);
    const x = localPos.x + 150;
    const y = localPos.y - 50;

    console.log('[MediaControls] Adding text note', { noteId, x, y });
    crdt?.addTextNote(noteId, '', x, y, 250, 150);
  }

  /**
   * Remove a text note by its ID.
   */
  removeTextNote(noteId: string): void {
    const { textNote } = this.deps;
    const crdt = this.deps.getCRDT();

    textNote?.removeTextNote(noteId);
    crdt?.removeTextNote(noteId);
  }
}

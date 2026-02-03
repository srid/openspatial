/**
 * Space Store
 * Central source of truth for space state. CRDT syncs with this store.
 * Components render from this store. No direct DOM manipulation.
 */
import { createSignal, createEffect, onCleanup, type Accessor } from 'solid-js';
import { createStore, produce, reconcile } from 'solid-js/store';
import type { CRDTManager } from '../modules/crdt.js';

// ==================== Types ====================

export interface Position {
  x: number;
  y: number;
}

export interface Participant {
  id: string;
  username: string;
  position: Position;
  isMuted: boolean;
  isVideoOff: boolean;
  isSpeaking: boolean;
  status: string;
  isLocal: boolean;
  stream?: MediaStream;
}

export interface ScreenShare {
  id: string;
  peerId: string;
  username: string;
  position: Position;
  width: number;
  height: number;
  stream?: MediaStream;
}

export interface TextNote {
  id: string;
  content: string;
  position: Position;
  width: number;
  height: number;
  fontSize: 'small' | 'medium' | 'large';
  fontFamily: 'sans' | 'serif' | 'mono';
  color: string;
}

export interface SpaceState {
  spaceId: string;
  localPeerId: string | null;
  username: string;
  isConnected: boolean;
  participants: Record<string, Participant>;
  screenShares: Record<string, ScreenShare>;
  textNotes: Record<string, TextNote>;
}

export interface LocalMediaState {
  isMuted: boolean;
  isVideoOff: boolean;
  isScreenSharing: boolean;
  localStream: MediaStream | null;
}

// ==================== Space Store ====================

const initialSpaceState: SpaceState = {
  spaceId: '',
  localPeerId: null,
  username: '',
  isConnected: false,
  participants: {},
  screenShares: {},
  textNotes: {},
};

const [spaceState, setSpaceState] = createStore<SpaceState>(initialSpaceState);

// ==================== Local Media Store ====================

const [localMedia, setLocalMedia] = createStore<LocalMediaState>({
  isMuted: false,
  isVideoOff: false,
  isScreenSharing: false,
  localStream: null,
});

// ==================== Derived State ====================

export const participantCount: Accessor<number> = () => 
  Object.keys(spaceState.participants).length;

export const participantList: Accessor<Participant[]> = () => 
  Object.values(spaceState.participants);

export const localParticipant: Accessor<Participant | null> = () => 
  spaceState.localPeerId ? spaceState.participants[spaceState.localPeerId] ?? null : null;

// ==================== Space Actions ====================

export function initializeSpace(spaceId: string, username: string): void {
  setSpaceState({ 
    spaceId, 
    username,
    isConnected: false,
    participants: {},
    screenShares: {},
    textNotes: {},
  });
}

export function setConnected(peerId: string): void {
  setSpaceState({ localPeerId: peerId, isConnected: true });
}

export function setDisconnected(): void {
  setSpaceState({ isConnected: false });
}

export function resetSpace(): void {
  setSpaceState(reconcile(initialSpaceState));
}

// ==================== Participant Actions ====================

export function addParticipant(participant: Omit<Participant, 'isLocal'>): void {
  const isLocal = participant.id === spaceState.localPeerId;
  setSpaceState('participants', participant.id, { ...participant, isLocal });
}

export function updateParticipantPosition(id: string, x: number, y: number): void {
  setSpaceState('participants', id, 'position', { x, y });
}

export function updateParticipantMedia(id: string, isMuted: boolean, isVideoOff: boolean): void {
  setSpaceState('participants', id, produce((p) => {
    if (p) {
      p.isMuted = isMuted;
      p.isVideoOff = isVideoOff;
    }
  }));
}

export function updateParticipantStatus(id: string, status: string): void {
  setSpaceState('participants', id, 'status', status);
}

export function updateParticipantSpeaking(id: string, isSpeaking: boolean): void {
  setSpaceState('participants', id, 'isSpeaking', isSpeaking);
}

export function setParticipantStream(id: string, stream: MediaStream): void {
  setSpaceState('participants', id, 'stream', stream);
}

export function removeParticipant(id: string): void {
  setSpaceState('participants', produce((participants) => {
    delete participants[id];
  }));
}

// ==================== Local Media Actions ====================

export function setLocalStream(stream: MediaStream): void {
  setLocalMedia('localStream', stream);
}

export function toggleMuted(): void {
  setLocalMedia('isMuted', (v) => !v);
  // Sync with actual track
  const stream = localMedia.localStream;
  if (stream) {
    stream.getAudioTracks().forEach(track => {
      track.enabled = !localMedia.isMuted;
    });
  }
}

export function toggleVideoOff(): void {
  setLocalMedia('isVideoOff', (v) => !v);
  // Sync with actual track
  const stream = localMedia.localStream;
  if (stream) {
    stream.getVideoTracks().forEach(track => {
      track.enabled = !localMedia.isVideoOff;
    });
  }
}

export function setScreenSharing(value: boolean): void {
  setLocalMedia('isScreenSharing', value);
}

// ==================== Screen Share Actions ====================

export function addScreenShare(share: ScreenShare): void {
  setSpaceState('screenShares', share.id, share);
}

export function updateScreenSharePosition(id: string, x: number, y: number): void {
  setSpaceState('screenShares', id, 'position', { x, y });
}

export function updateScreenShareSize(id: string, width: number, height: number): void {
  setSpaceState('screenShares', id, produce((s) => {
    if (s) {
      s.width = width;
      s.height = height;
    }
  }));
}

export function removeScreenShare(id: string): void {
  setSpaceState('screenShares', produce((shares) => {
    delete shares[id];
  }));
}

// ==================== Text Note Actions ====================

export function addTextNote(note: TextNote): void {
  setSpaceState('textNotes', note.id, note);
}

export function updateTextNotePosition(id: string, x: number, y: number): void {
  setSpaceState('textNotes', id, 'position', { x, y });
}

export function updateTextNoteContent(id: string, content: string): void {
  setSpaceState('textNotes', id, 'content', content);
}

export function updateTextNoteStyle(
  id: string, 
  fontSize: 'small' | 'medium' | 'large',
  fontFamily: 'sans' | 'serif' | 'mono',
  color: string
): void {
  setSpaceState('textNotes', id, produce((n) => {
    if (n) {
      n.fontSize = fontSize;
      n.fontFamily = fontFamily;
      n.color = color;
    }
  }));
}

export function removeTextNote(id: string): void {
  setSpaceState('textNotes', produce((notes) => {
    delete notes[id];
  }));
}

// ==================== Exports ====================

export { spaceState, localMedia };

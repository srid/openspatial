/**
 * Application Store
 * Central reactive store for all application state using SolidJS fine-grained reactivity.
 */
import { createSignal, type Accessor } from 'solid-js';
import { createStore, produce } from 'solid-js/store';
import type { ConnectionState } from '../components/ConnectionStatus';
import type { MediaState, ActivityState } from '../components/ControlBar';
import type { ParticipantsState } from '../components/JoinModal';

// ==================== Route State ====================

export type Route =
  | { type: 'landing' }
  | { type: 'join'; spaceId: string }
  | { type: 'space'; spaceId: string };

const [route, setRoute] = createSignal<Route>({ type: 'landing' });

export { route, setRoute };

// ==================== User State ====================

const STORAGE_KEY_USERNAME = 'openspatial-username';

const [username, setUsername] = createSignal(
  localStorage.getItem(STORAGE_KEY_USERNAME) ?? ''
);

export function saveUsername(name: string): void {
  localStorage.setItem(STORAGE_KEY_USERNAME, name);
  setUsername(name);
}

export { username };

// ==================== Space Info ====================

const [spaceName, setSpaceName] = createSignal('');
const [peerId, setPeerId] = createSignal<string | null>(null);

export { spaceName, setSpaceName, peerId, setPeerId };

// ==================== Participants ====================

export interface Participant {
  id: string;
  username: string;
  x: number;
  y: number;
  isMuted: boolean;
  isVideoOff: boolean;
  isSpeaking: boolean;
  status: string;
}

const [participants, setParticipants] = createStore<Record<string, Participant>>({});

// Use simple accessor functions instead of createMemo to avoid computations at module load
export const participantCount: Accessor<number> = () => 
  Object.keys(participants).length;

export const participantList: Accessor<Participant[]> = () => 
  Object.values(participants);

export function addParticipant(participant: Participant): void {
  setParticipants(produce((state) => {
    state[participant.id] = participant;
  }));
}

export function updateParticipant(id: string, updates: Partial<Participant>): void {
  setParticipants(produce((state) => {
    if (state[id]) {
      Object.assign(state[id], updates);
    }
  }));
}

export function removeParticipant(id: string): void {
  setParticipants(produce((state) => {
    delete state[id];
  }));
}

export function clearParticipants(): void {
  setParticipants({});
}

export { participants };

// ==================== Join Modal State ====================

const [joinParticipants, setJoinParticipants] = createSignal<ParticipantsState>({ type: 'loading' });
const [joinError, setJoinError] = createSignal<string | null>(null);

export { joinParticipants, setJoinParticipants, joinError, setJoinError };

// ==================== Connection State ====================

const [connectionState, setConnectionState] = createSignal<ConnectionState>('disconnected');
const [reconnectAttempt, setReconnectAttempt] = createSignal(0);

export { connectionState, setConnectionState, reconnectAttempt, setReconnectAttempt };

// ==================== Media State ====================

const [mediaState, setMediaState] = createStore<MediaState>({
  isMuted: false,
  isVideoOff: false,
  isScreenSharing: false,
});

export function toggleMuted(): void {
  setMediaState('isMuted', (v) => !v);
}

export function toggleVideoOff(): void {
  setMediaState('isVideoOff', (v) => !v);
}

export function setScreenSharing(value: boolean): void {
  setMediaState('isScreenSharing', value);
}

export const mediaStateAccessor: Accessor<MediaState> = () => ({ ...mediaState });

export { mediaState };

// ==================== Activity State ====================

export interface ActivityItem {
  id: string;
  type: 'join' | 'leave';
  username: string;
  timestamp: Date;
}

const [activityState, setActivityState] = createStore<ActivityState>({
  hasUnread: false,
  isOpen: false,
});

const [activityItems, setActivityItems] = createStore<ActivityItem[]>([]);

export function addActivity(item: Omit<ActivityItem, 'id'>): void {
  const newItem = { ...item, id: crypto.randomUUID() };
  setActivityItems((items) => [newItem, ...items.slice(0, 49)]);
  if (!activityState.isOpen) {
    setActivityState('hasUnread', true);
  }
}

export function toggleActivityPanel(): void {
  setActivityState('isOpen', (v) => !v);
  if (activityState.isOpen) {
    setActivityState('hasUnread', false);
  }
}

export function closeActivityPanel(): void {
  setActivityState('isOpen', false);
}

export const activityStateAccessor: Accessor<ActivityState> = () => ({ ...activityState });

export { activityState, activityItems };

// ==================== Canvas Transform ====================

const [canvasTransform, setCanvasTransform] = createStore({
  x: 0,
  y: 0,
  scale: 1,
});

export function panCanvas(dx: number, dy: number): void {
  setCanvasTransform(produce((t) => {
    t.x += dx;
    t.y += dy;
  }));
}

export function zoomCanvas(delta: number, centerX: number, centerY: number): void {
  setCanvasTransform(produce((t) => {
    const oldScale = t.scale;
    const newScale = Math.min(2, Math.max(0.25, oldScale + delta));
    // Zoom towards cursor
    t.x = centerX - (centerX - t.x) * (newScale / oldScale);
    t.y = centerY - (centerY - t.y) * (newScale / oldScale);
    t.scale = newScale;
  }));
}

export function setCanvasPosition(x: number, y: number): void {
  setCanvasTransform({ x, y, scale: canvasTransform.scale });
}

export { canvasTransform };

// ==================== Screen Shares ====================

export interface ScreenShareData {
  id: string;
  peerId: string;
  username: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

const [screenShares, setScreenShares] = createStore<Record<string, ScreenShareData>>({});

export function addScreenShare(share: ScreenShareData): void {
  setScreenShares(produce((state) => {
    state[share.id] = share;
  }));
}

export function updateScreenShare(id: string, updates: Partial<ScreenShareData>): void {
  setScreenShares(produce((state) => {
    if (state[id]) {
      Object.assign(state[id], updates);
    }
  }));
}

export function removeScreenShare(id: string): void {
  setScreenShares(produce((state) => {
    delete state[id];
  }));
}

export { screenShares };

// ==================== Text Notes ====================

export interface TextNoteData {
  id: string;
  content: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fontSize: 'small' | 'medium' | 'large';
  fontFamily: 'sans' | 'serif' | 'mono';
  color: string;
}

const [textNotes, setTextNotes] = createStore<Record<string, TextNoteData>>({});

export function addTextNote(note: TextNoteData): void {
  setTextNotes(produce((state) => {
    state[note.id] = note;
  }));
}

export function updateTextNote(id: string, updates: Partial<TextNoteData>): void {
  setTextNotes(produce((state) => {
    if (state[id]) {
      Object.assign(state[id], updates);
    }
  }));
}

export function removeTextNote(id: string): void {
  setTextNotes(produce((state) => {
    delete state[id];
  }));
}

export { textNotes };

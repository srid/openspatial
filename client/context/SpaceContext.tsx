/**
 * SpaceContext - Central state management for the space session
 */
import { createContext, useContext, createSignal, createMemo, ParentComponent, onCleanup, Accessor, Setter } from 'solid-js';
import type { PeerState, ScreenShareState, TextNoteState } from '../../shared/yjs-schema';

export type View = 'landing' | 'join' | 'space';
export type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'reconnecting';

export interface LocalUser {
  peerId: string;
  username: string;
  x: number;
  y: number;
  isMuted: boolean;
  isVideoOff: boolean;
  status: string;
  stream: MediaStream | null;
}

export interface SpaceSession {
  spaceId: string;
  localUser: LocalUser;
}

interface SpaceContextValue {
  // View state
  view: Accessor<View>;
  setView: Setter<View>;
  
  // Session state
  session: Accessor<SpaceSession | null>;
  setSession: Setter<SpaceSession | null>;
  
  // Connection state
  connectionState: Accessor<ConnectionState>;
  setConnectionState: Setter<ConnectionState>;
  
  // CRDT-derived reactive state
  peers: Accessor<Map<string, PeerState>>;
  setPeers: Setter<Map<string, PeerState>>;
  screenShares: Accessor<Map<string, ScreenShareState>>;
  setScreenShares: Setter<Map<string, ScreenShareState>>;
  textNotes: Accessor<Map<string, TextNoteState>>;
  setTextNotes: Setter<Map<string, TextNoteState>>;
  
  // Derived state
  participantCount: Accessor<number>;
  spaceId: Accessor<string | undefined>;
}

const SpaceContext = createContext<SpaceContextValue>();

export const SpaceProvider: ParentComponent = (props) => {
  // View routing based on URL
  const [view, setView] = createSignal<View>(getInitialView());
  
  // Session state
  const [session, setSession] = createSignal<SpaceSession | null>(null);
  
  // Connection state
  const [connectionState, setConnectionState] = createSignal<ConnectionState>('disconnected');
  
  // CRDT-derived state (will be populated by useCRDT hook)
  const [peers, setPeers] = createSignal<Map<string, PeerState>>(new Map());
  const [screenShares, setScreenShares] = createSignal<Map<string, ScreenShareState>>(new Map());
  const [textNotes, setTextNotes] = createSignal<Map<string, TextNoteState>>(new Map());
  
  // Derived values
  const participantCount = createMemo(() => peers().size);
  const spaceId = createMemo(() => session()?.spaceId);
  
  const value: SpaceContextValue = {
    view,
    setView,
    session,
    setSession,
    connectionState,
    setConnectionState,
    peers,
    setPeers,
    screenShares,
    setScreenShares,
    textNotes,
    setTextNotes,
    participantCount,
    spaceId,
  };
  
  return (
    <SpaceContext.Provider value={value}>
      {props.children}
    </SpaceContext.Provider>
  );
};

export function useSpace(): SpaceContextValue {
  const context = useContext(SpaceContext);
  if (!context) {
    throw new Error('useSpace must be used within a SpaceProvider');
  }
  return context;
}

function getInitialView(): View {
  const path = window.location.pathname;
  if (path.startsWith('/s/')) {
    return 'join';
  }
  return 'landing';
}

/**
 * Extract spaceId from URL path /s/:spaceId
 */
export function getSpaceIdFromUrl(): string | null {
  const match = window.location.pathname.match(/^\/s\/(.+)$/);
  return match ? decodeURIComponent(match[1]) : null;
}

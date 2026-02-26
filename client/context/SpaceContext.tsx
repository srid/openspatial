/**
 * SpaceContext
 * Central state manager for OpenSpatial.
 * Manages Socket.io, CRDT (Yjs), and WebRTC connections.
 */
import { createContext, useContext, createSignal, createMemo, onCleanup, batch } from 'solid-js';
import type { Accessor, Setter, ParentComponent } from 'solid-js';
import { io } from 'socket.io-client';
import type { Socket } from 'socket.io-client';
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';
import type { Awareness } from 'y-protocols/awareness';
import type { PeerState, ScreenShareState, TextNoteState, MediaPlayerState } from '../../shared/yjs-schema';
import { getTextNoteText, createTextNoteObservers } from '../../shared/yjs-schema';
import type { ConnectedEvent, SignalEvent, SpaceInfoEvent, PeerJoinedEvent, PeerLeftEvent, SpaceActivityItem, StreamsAnnouncedEvent, StreamAnnouncement, SocketEventMap } from '../../shared/types/events';
import { playJoinSound, playLeaveSound } from '../lib/sounds';

export type View = 'landing' | 'join' | 'space' | 'not-found';
export type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'reconnecting';

export interface LocalUser {
  peerId: string;
  username: string;
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
  crdtSynced: Accessor<boolean>;
  
  // CRDT-derived reactive state
  ydoc: Accessor<Y.Doc | null>;
  awareness: Accessor<Awareness | null>;
  peers: Accessor<Map<string, PeerState>>;
  screenShares: Accessor<Map<string, ScreenShareState>>;
  textNotes: Accessor<Map<string, TextNoteState>>;
  textNoteContents: Accessor<Map<string, string>>;
  mediaPlayers: Accessor<Map<string, MediaPlayerState>>;
  activities: Accessor<SpaceActivityItem[]>;
  
  // Derived state
  participantCount: Accessor<number>;
  spaceId: Accessor<string | undefined>;
  localMediaState: Accessor<{ isMuted: boolean; isVideoOff: boolean }>;
  
  // Media toggle actions (single source of truth)
  toggleMic: () => void;
  toggleCamera: () => void;
  
  // Canvas viewport state (shared between Canvas and Minimap)
  canvasOffset: Accessor<{ x: number; y: number }>;
  canvasScale: Accessor<number>;
  setCanvasOffset: Setter<{ x: number; y: number }>;
  setCanvasScale: Setter<number>;
  
  // Connection actions
  connectSignaling: () => Promise<void>;
  disconnectSignaling: () => void;
  connectCRDT: (spaceId: string) => void;
  disconnectCRDT: () => void;
  
  // Socket event helpers
  onSocket: <T>(event: string, handler: (data: T) => void) => void;
  onceSocket: <T>(event: string, handler: (data: T) => void) => void;
  emitSocket: (event: string, data: unknown) => void;
  
  // CRDT mutation helpers
  addPeer: (peerId: string, username: string, x: number, y: number, isMuted?: boolean, isVideoOff?: boolean) => void;
  removePeer: (peerId: string) => void;
  updatePeerPosition: (peerId: string, x: number, y: number) => void;
  updatePeerMediaState: (peerId: string, isMuted: boolean, isVideoOff: boolean) => void;
  updatePeerStatus: (peerId: string, status: string) => void;
  
  // Screen share mutations
  addScreenShare: (shareId: string, peerId: string, username: string, x: number, y: number, width: number, height: number) => void;
  removeScreenShare: (shareId: string) => void;
  updateScreenSharePosition: (shareId: string, x: number, y: number) => void;
  updateScreenShareSize: (shareId: string, width: number, height: number) => void;
  
  // Media stream storage (unified via StreamEntry sum type)
  screenShareStreams: Accessor<Map<string, MediaStream>>;
  setScreenShareStream: (shareId: string, stream: MediaStream) => void;
  removeScreenShareStream: (shareId: string) => void;
  addScreenShareToPeers: (stream: MediaStream, shareId: string) => Promise<void>;
  addLocalStreamToPeers: (stream: MediaStream) => Promise<void>;
  
  // Remote peer streams (derived from unified store)
  peerStreams: Accessor<Map<string, MediaStream>>;
  
  // WebRTC
  fetchIceServers: () => Promise<void>;
  initWebRTC: () => void;
  connectToPeers: (peers: Record<string, unknown>, localPeerId: string, localStream: MediaStream | null) => Promise<void>;
  peerConnectionStates: Accessor<Map<string, RTCPeerConnectionState>>;
  
  // Text note mutations
  addTextNote: (noteId: string, content: string, x: number, y: number, width: number, height: number) => void;
  removeTextNote: (noteId: string) => void;
  updateTextNotePosition: (noteId: string, x: number, y: number) => void;
  updateTextNoteSize: (noteId: string, width: number, height: number) => void;
  updateTextNoteStyle: (noteId: string, fontSize: 'small' | 'medium' | 'large', fontFamily: 'sans' | 'serif' | 'mono', color: string) => void;
  
  // Media Player mutations
  spawnMediaPlayer: (playerId: string, url: string, x: number, y: number) => void;
  removeMediaPlayer: (playerId: string) => void;
  updateMediaPlayerPosition: (playerId: string, x: number, y: number) => void;
  updateMediaPlayerSize: (playerId: string, width: number, height: number) => void;
  updateMediaPlayerState: (playerId: string, isPlaying: boolean, timestamp: number) => void;
}

const SpaceContext = createContext<SpaceContextValue>();

export const SpaceProvider: ParentComponent = (props) => {
  // View routing based on URL
  const [view, setView] = createSignal<View>(getInitialView());
  
  // Session state
  const [session, setSession] = createSignal<SpaceSession | null>(null);
  
  // Connection state
  const [connectionState, setConnectionState] = createSignal<ConnectionState>('disconnected');
  const [crdtSynced, setCrdtSynced] = createSignal(false);
  
  // CRDT-derived state
  const [peers, setPeers] = createSignal<Map<string, PeerState>>(new Map());
  const [screenShares, setScreenShares] = createSignal<Map<string, ScreenShareState>>(new Map());
  const [textNotes, setTextNotes] = createSignal<Map<string, TextNoteState>>(new Map());
  const [textNoteContents, setTextNoteContents] = createSignal<Map<string, string>>(new Map());
  const [mediaPlayers, setMediaPlayers] = createSignal<Map<string, MediaPlayerState>>(new Map());
  const [activities, setActivities] = createSignal<SpaceActivityItem[]>([]);
  
  // Unified remote stream store (StreamEntry sum type)
  type StreamEntry =
    | { kind: 'webcam'; peerId: string; stream: MediaStream }
    | { kind: 'screenshare'; shareId: string; stream: MediaStream };
  const [remoteStreams, setRemoteStreams] = createSignal<Map<string, StreamEntry>>(new Map());
  
  // Local screen share streams (streams WE are sending, not receiving)
  const [localScreenShareStreams, setLocalScreenShareStreams] = createSignal<Map<string, MediaStream>>(new Map());
  
  // Derived accessors for consumers
  const peerStreams = createMemo(() => {
    const map = new Map<string, MediaStream>();
    for (const e of remoteStreams().values()) {
      if (e.kind === 'webcam') map.set(e.peerId, e.stream);
    }
    return map;
  });
  const screenShareStreams = createMemo(() => {
    // Combine local and remote screen share streams
    const map = new Map<string, MediaStream>();
    for (const e of remoteStreams().values()) {
      if (e.kind === 'screenshare') map.set(e.shareId, e.stream);
    }
    // Also include local screen shares
    for (const [shareId, stream] of localScreenShareStreams()) {
      map.set(shareId, stream);
    }
    return map;
  });
  
  // Canvas viewport state (shared between Canvas and Minimap)
  const [canvasOffset, setCanvasOffset] = createSignal({ x: 0, y: 0 });
  const [canvasScale, setCanvasScale] = createSignal(1);
  
  // Per-peer WebRTC connection state (for UI indicators)
  const [peerConnectionStates, setPeerConnectionStates] = createSignal<Map<string, RTCPeerConnectionState>>(new Map());
  
  // ICE server config (fetched from server, includes TURN credentials when configured)
  const FALLBACK_ICE_SERVERS: RTCIceServer[] = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ];
  let iceServers: RTCIceServer[] = FALLBACK_ICE_SERVERS;
  
  // Derived values
  const participantCount = createMemo(() => peers().size);
  const spaceId = createMemo(() => session()?.spaceId);
  
  // Reactive media state derived from CRDT (single source of truth)
  const localMediaState = createMemo(() => {
    const s = session();
    if (!s) return { isMuted: false, isVideoOff: false };
    const peer = peers().get(s.localUser.peerId);
    return {
      isMuted: peer?.isMuted ?? false,
      isVideoOff: peer?.isVideoOff ?? false,
    };
  });
  
  function toggleMic() {
    const s = session();
    if (!s?.localUser.stream) return;
    const audioTrack = s.localUser.stream.getAudioTracks()[0];
    if (!audioTrack) return;
    audioTrack.enabled = !audioTrack.enabled;
    updatePeerMediaState(s.localUser.peerId, !audioTrack.enabled, localMediaState().isVideoOff);
  }
  
  function toggleCamera() {
    const s = session();
    if (!s?.localUser.stream) return;
    const videoTrack = s.localUser.stream.getVideoTracks()[0];
    if (!videoTrack) return;
    videoTrack.enabled = !videoTrack.enabled;
    updatePeerMediaState(s.localUser.peerId, localMediaState().isMuted, !videoTrack.enabled);
  }
  
  // --------------- Socket.io Management ---------------
  let socket: Socket | null = null;
  const socketHandlers = new Map<string, Set<(data: unknown) => void>>();
  const socketOnceHandlers = new Map<string, Set<(data: unknown) => void>>();
  
  // Stream announcements from remote peers (streamId -> announcement)
  const announcedStreams = new Map<string, { peerId: string } & StreamAnnouncement>();
  
  function connectSignaling(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (socket?.connected) {
        resolve();
        return;
      }
      
      setConnectionState('connecting');
      
      socket = io(window.location.origin, {
        transports: ['websocket'],
        upgrade: false,
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 10000,
        forceNew: false, // Reuse connection
      });
      
      socket.on('connect', () => {
        console.log('[Signaling] Connected');
        setConnectionState('connected');
        resolve();
      });
      
      socket.on('connect_error', (error: Error) => {
        console.error('[Signaling] Connection error:', error);
        reject(error);
      });
      
      socket.on('disconnect', (reason: string) => {
        console.log('[Signaling] Disconnected:', reason);
        if (reason !== 'io client disconnect') {
          setConnectionState('disconnected');
          
          // Eagerly snapshot CRDT state BEFORE y-websocket propagates the server's
          // cleanupCRDTOnDisconnect. By the time 'reconnect' fires, the old peer
          // entry will be gone from the CRDT map.
          const currentSession = session();
          if (currentSession) {
            const oldPeerId = currentSession.localUser.peerId;
            const peerState = peers().get(oldPeerId);
            if (peerState) {
              lastDisconnectState = {
                x: peerState.x,
                y: peerState.y,
                isMuted: peerState.isMuted,
                isVideoOff: peerState.isVideoOff,
              };
              console.log(`[Signaling] Snapshotted CRDT state for ${oldPeerId} before cleanup`);
            }
          }
        }
      });
      
      // Holds CRDT state from the moment of disconnect, snapshotted before y-websocket
      // propagates the server's cleanupCRDTOnDisconnect which deletes the old peer.
      let lastDisconnectState: { x: number; y: number; isMuted: boolean; isVideoOff: boolean } | null = null;
      
      socket.io.on('reconnect_attempt', (attempt: number) => {
        console.log(`[Signaling] Reconnection attempt ${attempt}`);
        setConnectionState('reconnecting');
      });
      
      socket.io.on('reconnect', () => {
        console.log('[Signaling] Reconnected');
        setConnectionState('connected');
        
        // Re-join the space so the server knows we're back
        const currentSession = session();
        if (currentSession) {
          console.log(`[Signaling] Re-joining space ${currentSession.spaceId} as ${currentSession.localUser.username}`);
          
          // CRITICAL: Server assigns a NEW peerId on every connection.
          // We must wait for 'connected' event to get the new peerId before re-establishing WebRTC.
          onceSocket('connected', (connData) => {
            const newPeerId = connData.peerId;
            const oldPeerId = currentSession.localUser.peerId;
            console.log(`[Signaling] Got new peerId: ${newPeerId} (was: ${oldPeerId})`);
            
            // Use eagerly-snapshotted state (from disconnect handler), falling back to
            // CRDT if still available, then defaults.
            const savedState = lastDisconnectState;
            const crdtState = peers().get(oldPeerId);
            const currentX = savedState?.x ?? crdtState?.x ?? 2000;
            const currentY = savedState?.y ?? crdtState?.y ?? 2000;
            const currentMuted = savedState?.isMuted ?? crdtState?.isMuted ?? false;
            const currentVideoOff = savedState?.isVideoOff ?? crdtState?.isVideoOff ?? false;
            lastDisconnectState = null; // consumed
            
            // Update CRDT presence with new peerId
            removePeer(oldPeerId);
            addPeer(newPeerId, currentSession.localUser.username, currentX, currentY, currentMuted, currentVideoOff);
            
            // Force session signal refresh so the new Avatar component's createEffect
            // re-fires and binds videoRef.srcObject to the (unchanged) local stream.
            // Without this, the new video element stays black because SolidJS sees the
            // same stream reference and skips the effect.
            setSession({
              ...currentSession,
              localUser: {
                ...currentSession.localUser,
                peerId: newPeerId,
                // Clone stream reference to force reactivity
                stream: currentSession.localUser.stream,
              },
            });
            
            // Listen for space-state to re-establish WebRTC with existing peers
            onceSocket('space-state', async (stateData) => {
              console.log('[Signaling] Received space-state after reconnect, re-establishing WebRTC');
              await connectToPeers(stateData.peers, newPeerId, currentSession.localUser.stream);
            });
          });
          
          socket?.emit('join-space', {
            spaceId: currentSession.spaceId,
            username: currentSession.localUser.username,
          });
        }
      });
      
      // Register activity listener at connection time (before join-space)
      // so we never miss events emitted at join time
      onSocket('space-activity', (data) => {
        setActivities(data.events.slice(0, 10));
      });
      
      // Forward events to handlers
      const events = ['connected', 'space-info', 'space-state', 'peer-joined', 'peer-left', 'signal', 'screen-share-started', 'screen-share-stopped', 'space-activity', 'streams-announced'];
      for (const event of events) {
        socket.on(event, (data: unknown) => {
          triggerSocketEvent(event, data);
        });
      }
    });
  }
  
  function disconnectSignaling() {
    socket?.disconnect();
    socket = null;
    socketHandlers.clear();
    socketOnceHandlers.clear();
    setConnectionState('disconnected');
    
    // Reset WebRTC state so initWebRTC() re-registers handlers on rejoin
    webrtcInitialized = false;
    for (const [, pc] of peerConnections.entries()) {
      pc.close();
    }
    peerConnections.clear();
    pendingIceCandidates.clear();
    announcedStreams.clear();
    setPeerConnectionStates(new Map());
    setRemoteStreams(new Map());
  }
  
  function onSocket<K extends keyof SocketEventMap>(event: K, handler: (data: SocketEventMap[K]) => void): void;
  function onSocket(event: string, handler: (data: unknown) => void): void;
  function onSocket(event: string, handler: (data: unknown) => void) {
    if (!socketHandlers.has(event)) {
      socketHandlers.set(event, new Set());
    }
    socketHandlers.get(event)!.add(handler);
  }
  
  function onceSocket<K extends keyof SocketEventMap>(event: K, handler: (data: SocketEventMap[K]) => void): void;
  function onceSocket(event: string, handler: (data: unknown) => void): void;
  function onceSocket(event: string, handler: (data: unknown) => void) {
    if (!socketOnceHandlers.has(event)) {
      socketOnceHandlers.set(event, new Set());
    }
    socketOnceHandlers.get(event)!.add(handler);
  }
  
  function triggerSocketEvent(event: string, data: unknown) {
    socketHandlers.get(event)?.forEach((h) => h(data));
    const once = socketOnceHandlers.get(event);
    if (once) {
      once.forEach((h) => h(data));
      socketOnceHandlers.delete(event);
    }
  }
  
  function emitSocket<K extends keyof SocketEventMap>(event: K, data: SocketEventMap[K]): void;
  function emitSocket(event: string, data: unknown): void;
  function emitSocket(event: string, data: unknown) {
    socket?.emit(event, data);
  }
  
  // --------------- CRDT Management ---------------
  const [ydocSignal, setYdocSignal] = createSignal<Y.Doc | null>(null);
  const [awarenessSignal, setAwarenessSignal] = createSignal<Awareness | null>(null);
  // Track Y.Text observers so we can clean them up
  let contentObservers: ReturnType<typeof createTextNoteObservers> | null = null;
  let ydoc: Y.Doc | null = null;
  let yprovider: WebsocketProvider | null = null;
  let peersMap: Y.Map<PeerState> | null = null;
  let screenSharesMap: Y.Map<ScreenShareState> | null = null;
  let textNotesMap: Y.Map<TextNoteState> | null = null;
  let mediaPlayersMap: Y.Map<MediaPlayerState> | null = null;
  
  function connectCRDT(spaceId: string) {
    if (ydoc) {
      disconnectCRDT();
    }
    
    ydoc = new Y.Doc();
    setYdocSignal(ydoc);
    
    contentObservers = createTextNoteObservers(ydoc, (noteId) => {
      setTextNoteContents(prev => {
        const next = new Map(prev);
        next.set(noteId, getTextNoteText(ydoc!, noteId).toString());
        return next;
      });
    });
    
    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${wsProtocol}//${window.location.host}/yjs`;
    yprovider = new WebsocketProvider(wsUrl, spaceId, ydoc);
    setAwarenessSignal(yprovider.awareness as Awareness);
    
    peersMap = ydoc.getMap<PeerState>('peers');
    screenSharesMap = ydoc.getMap<ScreenShareState>('screenShares');
    textNotesMap = ydoc.getMap<TextNoteState>('textNotes');
    mediaPlayersMap = ydoc.getMap<MediaPlayerState>('mediaPlayers');
    
    // Bridge Yjs observers to SolidJS signals
    peersMap.observe(() => {
      // Deep-clone to create new object references for SolidJS reactivity
      const clonedMap = new Map<string, PeerState>();
      peersMap!.forEach((value, key) => {
        clonedMap.set(key, { ...value });
      });
      setPeers(clonedMap);
    });
    
    screenSharesMap.observe(() => {
      setScreenShares(new Map(screenSharesMap!.entries()));
    });
    
    textNotesMap.observe((event) => {
      // Deep-clone to create new object references for SolidJS reactivity
      const clonedMap = new Map<string, TextNoteState>();
      textNotesMap!.forEach((value, key) => {
        clonedMap.set(key, { ...value });
      });
      setTextNotes(clonedMap);
      
      // Set up Y.Text observers for new notes, clean up for deleted
      event.changes.keys.forEach((change, key) => {
        if (change.action === 'add') {
          // Update contents immediately for new notes
          setTextNoteContents(prev => {
            const next = new Map(prev);
            next.set(key, getTextNoteText(ydoc!, key).toString());
            return next;
          });
          contentObservers!.observe(key);
        } else if (change.action === 'delete') {
          contentObservers!.unobserve(key);
          setTextNoteContents(prev => {
            const next = new Map(prev);
            next.delete(key);
            return next;
          });
        }
      });
    });
    
    mediaPlayersMap.observe(() => {
      const clonedMap = new Map<string, MediaPlayerState>();
      mediaPlayersMap!.forEach((value, key) => {
        clonedMap.set(key, { ...value });
      });
      setMediaPlayers(clonedMap);
    });
    
    yprovider.on('status', ({ status }: { status: string }) => {
      console.log(`[CRDT] Status: ${status}`);
    });
    
    yprovider.on('synced', (isSynced: boolean) => {
      console.log(`[CRDT] Synced: ${isSynced}`);
      setCrdtSynced(isSynced);
      
      if (isSynced) {
        // Deep-clone to create new object references for SolidJS reactivity
        const clonedTextNotes = new Map<string, TextNoteState>();
        textNotesMap!.forEach((value, key) => {
          clonedTextNotes.set(key, { ...value });
        });
        const clonedMediaPlayers = new Map<string, MediaPlayerState>();
        mediaPlayersMap!.forEach((value, key) => {
          clonedMediaPlayers.set(key, { ...value });
        });
        batch(() => {
          setPeers(new Map(peersMap!.entries()));
          setScreenShares(new Map(screenSharesMap!.entries()));
          setTextNotes(clonedTextNotes);
          setMediaPlayers(clonedMediaPlayers);
        });
        
        // Set up Y.Text observers for existing notes after initial sync
        textNotesMap!.forEach((_value, key) => {
          // Update contents immediately
          setTextNoteContents(prev => {
            const next = new Map(prev);
            next.set(key, getTextNoteText(ydoc!, key).toString());
            return next;
          });
          contentObservers!.observe(key);
        });
      }
    });
  }
  
  function disconnectCRDT() {
    // Clean up all Y.Text observers
    contentObservers?.clear();
    contentObservers = null;
    
    yprovider?.disconnect();
    yprovider?.destroy();
    ydoc?.destroy();
    
    ydoc = null;
    yprovider = null;
    peersMap = null;
    screenSharesMap = null;
    textNotesMap = null;
    mediaPlayersMap = null;
    
    setYdocSignal(null);
    setAwarenessSignal(null);
    setCrdtSynced(false);
  }
  
  // CRDT Mutations
  function addPeer(peerId: string, username: string, x: number, y: number, isMuted = false, isVideoOff = false) {
    peersMap?.set(peerId, { username, x, y, isMuted, isVideoOff, status: '' });
  }
  
  function removePeer(peerId: string) {
    peersMap?.delete(peerId);
  }
  
  function updatePeerPosition(peerId: string, x: number, y: number) {
    const peer = peersMap?.get(peerId);
    if (peer) {
      peersMap?.set(peerId, { ...peer, x, y });
    }
  }
  
  function updatePeerMediaState(peerId: string, isMuted: boolean, isVideoOff: boolean) {
    const peer = peersMap?.get(peerId);
    if (peer) {
      peersMap?.set(peerId, { ...peer, isMuted, isVideoOff });
    }
  }
  
  function updatePeerStatus(peerId: string, status: string) {
    const peer = peersMap?.get(peerId);
    if (peer) {
      peersMap?.set(peerId, { ...peer, status });
    }
  }
  
  function addScreenShare(shareId: string, peerId: string, username: string, x: number, y: number, width: number, height: number) {
    screenSharesMap?.set(shareId, { peerId, username, x, y, width, height });
  }
  
  function removeScreenShare(shareId: string) {
    screenSharesMap?.delete(shareId);
  }
  
  function updateScreenSharePosition(shareId: string, x: number, y: number) {
    const share = screenSharesMap?.get(shareId);
    if (share) {
      screenSharesMap?.set(shareId, { ...share, x, y });
    }
  }
  
  function updateScreenShareSize(shareId: string, width: number, height: number) {
    const share = screenSharesMap?.get(shareId);
    if (share) {
      screenSharesMap?.set(shareId, { ...share, width, height });
    }
  }
  

  
  function addTextNote(noteId: string, content: string, x: number, y: number, width: number, height: number) {
    textNotesMap?.set(noteId, { x, y, width, height, fontSize: 'medium', fontFamily: 'sans', color: '#ffffff' });
    // Initialize Y.Text with content
    if (ydoc && content) {
      getTextNoteText(ydoc, noteId).insert(0, content);
    }
  }
  
  function removeTextNote(noteId: string) {
    textNotesMap?.delete(noteId);
    // Clean up Y.Text content
    if (ydoc) {
      const ytext = getTextNoteText(ydoc, noteId);
      if (ytext.length > 0) {
        ytext.delete(0, ytext.length);
      }
    }
  }
  
  function updateTextNotePosition(noteId: string, x: number, y: number) {
    const note = textNotesMap?.get(noteId);
    if (note) {
      textNotesMap?.set(noteId, { ...note, x, y });
    }
  }
  
  // Note: updateTextNoteContent removed — content is now edited via CodeMirror → Y.Text directly
  
  function updateTextNoteSize(noteId: string, width: number, height: number) {
    const note = textNotesMap?.get(noteId);
    if (note) {
      textNotesMap?.set(noteId, { ...note, width, height });
    }
  }
  
  function updateTextNoteStyle(noteId: string, fontSize: 'small' | 'medium' | 'large', fontFamily: 'sans' | 'serif' | 'mono', color: string) {
    const note = textNotesMap?.get(noteId);
    if (note) {
      textNotesMap?.set(noteId, { ...note, fontSize, fontFamily, color });
    }
  }
  
  // Media Player mutations
  function spawnMediaPlayer(playerId: string, url: string, x: number, y: number) {
    mediaPlayersMap?.set(playerId, {
      url,
      x,
      y,
      width: 640,
      height: 360,
      isPlaying: false,
      timestamp: 0,
      lastUpdatedAt: Date.now()
    });
  }
  
  function removeMediaPlayer(playerId: string) {
    mediaPlayersMap?.delete(playerId);
  }
  
  function updateMediaPlayerPosition(playerId: string, x: number, y: number) {
    const player = mediaPlayersMap?.get(playerId);
    if (player) {
      mediaPlayersMap?.set(playerId, { ...player, x, y });
    }
  }
  
  function updateMediaPlayerSize(playerId: string, width: number, height: number) {
    const player = mediaPlayersMap?.get(playerId);
    if (player) {
      mediaPlayersMap?.set(playerId, { ...player, width, height });
    }
  }

  function updateMediaPlayerState(playerId: string, isPlaying: boolean, timestamp: number) {
    const player = mediaPlayersMap?.get(playerId);
    if (player) {
      mediaPlayersMap?.set(playerId, { ...player, isPlaying, timestamp, lastUpdatedAt: Date.now() });
    }
  }
  
  // Unified remote stream management
  function setRemoteStream(key: string, entry: StreamEntry) {
    setRemoteStreams(prev => {
      const next = new Map(prev);
      next.set(key, entry);
      return next;
    });
  }
  
  function removeRemoteStreamsByPeer(peerId: string) {
    setRemoteStreams(prev => {
      const next = new Map(prev);
      for (const [key, entry] of next.entries()) {
        if (entry.kind === 'webcam' && entry.peerId === peerId) next.delete(key);
      }
      return next;
    });
  }
  
  function removeRemoteStream(key: string) {
    setRemoteStreams(prev => {
      const next = new Map(prev);
      next.delete(key);
      return next;
    });
  }
  
  // Local screen share stream management (streams WE send)
  function setScreenShareStream(shareId: string, stream: MediaStream) {
    setLocalScreenShareStreams(prev => {
      const next = new Map(prev);
      next.set(shareId, stream);
      return next;
    });
  }
  
  function removeScreenShareStream(shareId: string) {
    setLocalScreenShareStreams(prev => {
      const next = new Map(prev);
      const stream = next.get(shareId);
      if (stream) {
        stream.getTracks().forEach(t => t.stop());
        next.delete(shareId);
      }
      return next;
    });
  }
  
  /**
   * Route an incoming track to the correct stream entry based on announcements.
   * Exhaustive switch — no catchall else.
   * Buffers unannounced tracks and replays them when announcements arrive.
   */
  const pendingTracks: Array<{ peerId: string; track: MediaStreamTrack; stream: MediaStream }> = [];
  
  function routeIncomingTrack(peerId: string, track: MediaStreamTrack, stream: MediaStream) {
    const announced = announcedStreams.get(stream.id);
    if (!announced) {
      // Audio tracks often share the webcam stream ID — allow those through
      if (track.kind === 'audio') return;
      // Buffer unannounced tracks — streams-announced may arrive after ontrack
      console.log(`[WebRTC] Buffering unannounced stream ${stream.id} from ${peerId}`);
      pendingTracks.push({ peerId, track, stream });
      return;
    }
    switch (announced.kind) {
      case 'webcam':
        setRemoteStream(stream.id, { kind: 'webcam', peerId, stream });
        break;
      case 'screenshare':
        setRemoteStream(stream.id, { kind: 'screenshare', shareId: announced.shareId, stream });
        break;
    }
  }
  
  function flushPendingTracks() {
    const remaining: typeof pendingTracks = [];
    for (const entry of pendingTracks) {
      const announced = announcedStreams.get(entry.stream.id);
      if (announced) {
        switch (announced.kind) {
          case 'webcam':
            setRemoteStream(entry.stream.id, { kind: 'webcam', peerId: entry.peerId, stream: entry.stream });
            break;
          case 'screenshare':
            setRemoteStream(entry.stream.id, { kind: 'screenshare', shareId: announced.shareId, stream: entry.stream });
            break;
        }
      } else {
        remaining.push(entry);
      }
    }
    pendingTracks.length = 0;
    pendingTracks.push(...remaining);
  }
  
  // WebRTC peer connection infrastructure
  const peerConnections = new Map<string, RTCPeerConnection>();
  // Buffer ICE candidates that arrive before the remote description is set
  const pendingIceCandidates = new Map<string, RTCIceCandidateInit[]>();
  
  /**
   * Add screen share tracks to all existing peer connections.
   * This triggers renegotiation to send the screen share stream to peers.
   */
  async function addScreenShareToPeers(stream: MediaStream, shareId: string) {
    console.log(`[WebRTC] Adding screen share to ${peerConnections.size} peer connections`);
    const localPeerId = session()?.localUser.peerId;
    
    for (const [peerId, pc] of peerConnections.entries()) {
      // Announce the screen share stream before renegotiation
      emitSocket('streams-announced', {
        peerId: localPeerId!,
        streams: [{ streamId: stream.id, kind: 'screenshare', shareId }],
      });
      
      // Add all tracks from the screen share stream
      stream.getTracks().forEach(track => {
        console.log(`[WebRTC] Adding screen share track to ${peerId}: ${track.kind}`);
        pc.addTrack(track, stream);
      });
      
      // Trigger renegotiation by creating a new offer
      try {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        emitSocket('signal', {
          to: peerId,
          from: localPeerId,
          signal: { type: 'offer', sdp: offer },
        });
      } catch (e) {
        console.error(`[WebRTC] Failed to renegotiate with ${peerId}:`, e);
      }
    }
  }
  
  /**
   * Add local webcam tracks to all existing peer connections.
   * Used when a user enables their camera/mic after joining without media.
   */
  async function addLocalStreamToPeers(stream: MediaStream) {
    console.log(`[WebRTC] Adding local stream to ${peerConnections.size} peer connections`);
    const localPeerId = session()?.localUser.peerId;
    
    for (const [peerId, pc] of peerConnections.entries()) {
      // Announce webcam stream before renegotiation
      emitSocket('streams-announced', {
        peerId: localPeerId!,
        streams: [{ streamId: stream.id, kind: 'webcam' }],
      });
      
      const senders = pc.getSenders();
      const existingTrackIds = new Set(senders.map(s => s.track?.id).filter(Boolean));
      
      stream.getTracks().forEach(track => {
        if (!existingTrackIds.has(track.id)) {
          console.log(`[WebRTC] Adding local track to ${peerId}: ${track.kind}`);
          pc.addTrack(track, stream);
        }
      });
      
      // Trigger renegotiation
      try {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        emitSocket('signal', {
          to: peerId,
          from: localPeerId,
          signal: { type: 'offer', sdp: offer },
        });
      } catch (e) {
        console.error(`[WebRTC] Failed to renegotiate with ${peerId}:`, e);
      }
    }
  }
  
  async function flushIceCandidates(peerId: string, pc: RTCPeerConnection) {
    const buffered = pendingIceCandidates.get(peerId);
    if (buffered) {
      for (const candidate of buffered) {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      }
      pendingIceCandidates.delete(peerId);
    }
  }

  let webrtcInitialized = false;
  
  function initWebRTC() {
    if (webrtcInitialized) return;
    webrtcInitialized = true;
    
    // Handle incoming signals (offers from new joiners, answers to our offers, ICE candidates)
    onSocket('signal', async (data) => {
      const { from, signal } = data;
      
      let pc = peerConnections.get(from);
      if (!pc) {
        pc = createPeerConnection(from);
      }
      
      if (signal.type === 'offer' && signal.sdp) {
        // Before setting remote description, add our local webcam tracks so they are included in the answer
        const localStream = session()?.localUser.stream;
        const localPeerId = session()?.localUser.peerId;
        const announcements: StreamsAnnouncedEvent['streams'] = [];
        if (localStream) {
          const senders = pc.getSenders();
          const existingTrackIds = new Set(senders.map(s => s.track?.id).filter(Boolean));
          let addedTracks = false;
          localStream.getTracks().forEach(track => {
            if (!existingTrackIds.has(track.id)) {
              console.log(`[WebRTC] Adding local track to answer for ${from}: ${track.kind}`);
              pc.addTrack(track, localStream);
              addedTracks = true;
            }
          });
          if (addedTracks) {
            announcements.push({ streamId: localStream.id, kind: 'webcam' });
          }
        }
        // Announce our streams to the joiner so they can route ontrack events
        if (announcements.length > 0 && localPeerId) {
          emitSocket('streams-announced', { peerId: localPeerId, streams: announcements });
        }
        // NOTE: Screen share tracks are NOT added here — they are sent via renegotiation
        // in onconnectionstatechange('connected') to avoid timing issues.
        
        await pc.setRemoteDescription(new RTCSessionDescription(signal.sdp));
        await flushIceCandidates(from, pc);
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        emitSocket('signal', {
          to: from,
          from: localPeerId,
          signal: { type: 'answer', sdp: answer },
        });
      } else if (signal.type === 'answer' && signal.sdp) {
        await pc.setRemoteDescription(new RTCSessionDescription(signal.sdp));
        await flushIceCandidates(from, pc);
      } else if (signal.type === 'candidate' && signal.candidate) {
        if (pc.remoteDescription) {
          await pc.addIceCandidate(new RTCIceCandidate(signal.candidate));
        } else {
          // Buffer until remote description is set
          if (!pendingIceCandidates.has(from)) {
            pendingIceCandidates.set(from, []);
          }
          pendingIceCandidates.get(from)!.push(signal.candidate);
        }
      }
    });
    
    // peer-joined is UI-only: the joiner initiates WebRTC via connectToPeers()
    onSocket('peer-joined', () => {
      playJoinSound();
    });
    
    // When a peer leaves, close connection
    onSocket('peer-left', (data) => {
      playLeaveSound();
      const pc = peerConnections.get(data.peerId);
      if (pc) {
        pc.close();
        peerConnections.delete(data.peerId);
      }
      removeRemoteStreamsByPeer(data.peerId);
      pendingIceCandidates.delete(data.peerId);
      // Clean up announcements for this peer
      for (const [key, ann] of announcedStreams.entries()) {
        if (ann.peerId === data.peerId) announcedStreams.delete(key);
      }
      setPeerConnectionStates(prev => {
        const next = new Map(prev);
        next.delete(data.peerId);
        return next;
      });
    });
    
    // Listen for stream announcements from remote peers
    onSocket('streams-announced', (data) => {
      console.log(`[WebRTC] Streams announced from ${data.peerId}:`, data.streams.map(s => `${s.kind}:${s.streamId}`));
      for (const s of data.streams) {
        announcedStreams.set(s.streamId, { peerId: data.peerId, ...s });
      }
      // Replay any buffered ontrack events that were waiting for announcements
      flushPendingTracks();
    });
    
    // screen-share-started is now UI-only (for CRDT screen share tracking)
    // Stream routing is handled by streams-announced + routeIncomingTrack
    onSocket('screen-share-started', (_data) => {
      // No-op: screen share stream routing handled via streams-announced
    });
  }
  
  /**
   * Initiate WebRTC connections to all peers in the space.
   * Called by the joiner after setup is complete — the joiner always initiates offers
   * so there's no race between handler registration and incoming offers.
   */
  async function connectToPeers(
    peers: Record<string, unknown>,
    localPeerId: string,
    localStream: MediaStream | null
  ) {
    // Close any stale connections
    for (const [, pc] of peerConnections.entries()) {
      pc.close();
    }
    peerConnections.clear();
    
    for (const peerId of Object.keys(peers)) {
      if (peerId === localPeerId) continue;
      
      console.log(`[WebRTC] Initiating connection to ${peerId}`);
      const pc = createPeerConnection(peerId);
      
      // Build stream announcements
      const announcements: StreamsAnnouncedEvent['streams'] = [];
      
      if (localStream) {
        announcements.push({ streamId: localStream.id, kind: 'webcam' });
        localStream.getTracks().forEach(track => pc.addTrack(track, localStream));
      }
      
      // Add any local screen shares
      for (const [shareId, stream] of localScreenShareStreams().entries()) {
        announcements.push({ streamId: stream.id, kind: 'screenshare', shareId });
        stream.getTracks().forEach(track => pc.addTrack(track, stream));
        emitSocket('screen-share-started', { peerId: localPeerId, shareId });
      }
      
      // Announce all streams before sending offer
      if (announcements.length > 0) {
        emitSocket('streams-announced', { peerId: localPeerId, streams: announcements });
      }
      
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      emitSocket('signal', {
        to: peerId,
        from: localPeerId,
        signal: { type: 'offer', sdp: offer },
      });
    }
  }
  
  /**
   * Fetch ICE servers (including TURN credentials) from the server API.
   * Must be called before initWebRTC() to ensure TURN relay is available.
   */
  async function fetchIceServers(): Promise<void> {
    try {
      const response = await fetch('/api/ice-servers');
      if (response.ok) {
        iceServers = await response.json();
        console.log('[WebRTC] ICE servers loaded:', iceServers.length, 'servers');
      }
    } catch (error) {
      console.warn('[WebRTC] Failed to fetch ICE servers, using STUN-only fallback:', error);
    }
  }
  
  function createPeerConnection(peerId: string): RTCPeerConnection {
    const pc = new RTCPeerConnection({ iceServers });
    peerConnections.set(peerId, pc);
    
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        emitSocket('signal', {
          to: peerId,
          from: session()?.localUser.peerId,
          signal: { type: 'candidate', candidate: event.candidate },
        });
      }
    };
    
    pc.ontrack = (event) => {
      const stream = event.streams[0];
      if (stream) routeIncomingTrack(peerId, event.track, stream);
    };
    
    pc.onconnectionstatechange = () => {
      console.log(`[WebRTC] Connection with ${peerId}: ${pc.connectionState}`);
      // Update reactive state for UI
      setPeerConnectionStates(prev => {
        const next = new Map(prev);
        next.set(peerId, pc.connectionState);
        return next;
      });
      if (pc.connectionState === 'connected') {
        // Send any local screen shares to this peer via renegotiation.
        const localPeerId = session()?.localUser.peerId;
        let hasScreenShares = false;
        const shareAnnouncements: StreamsAnnouncedEvent['streams'] = [];
        for (const [shareId, stream] of localScreenShareStreams().entries()) {
          const existingSenderTrackIds = new Set(pc.getSenders().map(s => s.track?.id).filter(Boolean));
          let addedTracks = false;
          stream.getTracks().forEach(track => {
            if (!existingSenderTrackIds.has(track.id)) {
              pc.addTrack(track, stream);
              addedTracks = true;
            }
          });
          if (addedTracks) {
            hasScreenShares = true;
            shareAnnouncements.push({ streamId: stream.id, kind: 'screenshare', shareId });
            emitSocket('screen-share-started', { peerId: localPeerId!, shareId, username: session()?.localUser.username! });
          }
        }
        if (hasScreenShares) {
          // Announce screen share streams before renegotiation
          emitSocket('streams-announced', { peerId: localPeerId!, streams: shareAnnouncements });
          pc.createOffer().then(offer => {
            pc.setLocalDescription(offer);
            emitSocket('signal', {
              to: peerId,
              from: localPeerId,
              signal: { type: 'offer', sdp: offer },
            });
          }).catch(e => console.error(`[WebRTC] Screen share renegotiation failed:`, e));
        }
      }
      if (pc.connectionState === 'failed') {
        pc.close();
        peerConnections.delete(peerId);
        removeRemoteStreamsByPeer(peerId);
      }
    };
    
    return pc;
  }
  
  // Browser offline/online event handlers
  const handleOffline = () => {
    console.log('[Connection] Browser went offline');
    setConnectionState('disconnected');
  };
  
  const handleOnline = () => {
    console.log('[Connection] Browser came online');
    // If we have a socket connection, set to connected
    if (socket?.connected) {
      setConnectionState('connected');
    } else if (socket) {
      setConnectionState('reconnecting');
      socket.connect();
    }
  };
  
  // Set up offline/online listeners
  if (typeof window !== 'undefined') {
    window.addEventListener('offline', handleOffline);
    window.addEventListener('online', handleOnline);
  }
  
  // Cleanup on unmount
  onCleanup(() => {
    disconnectSignaling();
    disconnectCRDT();
    if (typeof window !== 'undefined') {
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('online', handleOnline);
    }
  });
  
  const value: SpaceContextValue = {
    view,
    setView,
    session,
    setSession,
    connectionState,
    crdtSynced,
    ydoc: ydocSignal,
    awareness: awarenessSignal,
    peers,
    screenShares,
    textNotes,
    textNoteContents,
    mediaPlayers,
    activities,
    participantCount,
    spaceId,
    localMediaState,
    toggleMic,
    toggleCamera,
    canvasOffset,
    canvasScale,
    setCanvasOffset,
    setCanvasScale,
    connectSignaling,
    disconnectSignaling,
    connectCRDT,
    disconnectCRDT,
    onSocket,
    onceSocket,
    emitSocket,
    addPeer,
    removePeer,
    updatePeerPosition,
    updatePeerMediaState,
    updatePeerStatus,
    addScreenShare,
    removeScreenShare,
    updateScreenSharePosition,
    updateScreenShareSize,
    addTextNote,
    removeTextNote,
    updateTextNotePosition,
    updateTextNoteSize,
    updateTextNoteStyle,
    spawnMediaPlayer,
    removeMediaPlayer,
    updateMediaPlayerPosition,
    updateMediaPlayerSize,
    updateMediaPlayerState,
    screenShareStreams,
    setScreenShareStream,
    removeScreenShareStream,
    addScreenShareToPeers,
    addLocalStreamToPeers,
    peerStreams,
    fetchIceServers,
    initWebRTC,
    connectToPeers,
    peerConnectionStates,
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

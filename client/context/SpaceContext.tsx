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
import type { PeerState, ScreenShareState, TextNoteState } from '../../shared/yjs-schema';
import { getTextNoteText, createTextNoteObservers } from '../../shared/yjs-schema';
import type { ConnectedEvent, SpaceInfoEvent, PeerJoinedEvent, PeerLeftEvent } from '../../shared/types/events';

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
  crdtSynced: Accessor<boolean>;
  
  // CRDT-derived reactive state
  ydoc: Accessor<Y.Doc | null>;
  awareness: Accessor<Awareness | null>;
  peers: Accessor<Map<string, PeerState>>;
  screenShares: Accessor<Map<string, ScreenShareState>>;
  textNotes: Accessor<Map<string, TextNoteState>>;
  textNoteContents: Accessor<Map<string, string>>;
  
  // Derived state
  participantCount: Accessor<number>;
  spaceId: Accessor<string | undefined>;
  
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
  addPeer: (peerId: string, username: string, x: number, y: number) => void;
  removePeer: (peerId: string) => void;
  updatePeerPosition: (peerId: string, x: number, y: number) => void;
  updatePeerMediaState: (peerId: string, isMuted: boolean, isVideoOff: boolean) => void;
  updatePeerStatus: (peerId: string, status: string) => void;
  
  // Screen share mutations
  addScreenShare: (shareId: string, peerId: string, username: string, x: number, y: number, width: number, height: number) => void;
  removeScreenShare: (shareId: string) => void;
  updateScreenSharePosition: (shareId: string, x: number, y: number) => void;
  updateScreenShareSize: (shareId: string, width: number, height: number) => void;
  
  // Media stream storage
  screenShareStreams: Accessor<Map<string, MediaStream>>;
  setScreenShareStream: (shareId: string, stream: MediaStream) => void;
  removeScreenShareStream: (shareId: string) => void;
  addScreenShareToPeers: (stream: MediaStream) => Promise<void>;
  
  // Remote peer streams (for Avatar video)
  peerStreams: Accessor<Map<string, MediaStream>>;
  setPeerStream: (peerId: string, stream: MediaStream) => void;
  removePeerStream: (peerId: string) => void;
  
  // WebRTC
  initWebRTC: () => void;
  
  // Text note mutations
  addTextNote: (noteId: string, content: string, x: number, y: number, width: number, height: number) => void;
  removeTextNote: (noteId: string) => void;
  updateTextNotePosition: (noteId: string, x: number, y: number) => void;
  updateTextNoteSize: (noteId: string, width: number, height: number) => void;
  updateTextNoteStyle: (noteId: string, fontSize: 'small' | 'medium' | 'large', fontFamily: 'sans' | 'serif' | 'mono', color: string) => void;
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
  
  // Local media streams (not in CRDT, but needed for rendering)
  const [screenShareStreams, setScreenShareStreams] = createSignal<Map<string, MediaStream>>(new Map());
  const [peerStreams, setPeerStreams] = createSignal<Map<string, MediaStream>>(new Map());
  
  // Derived values
  const participantCount = createMemo(() => peers().size);
  const spaceId = createMemo(() => session()?.spaceId);
  
  // --------------- Socket.io Management ---------------
  let socket: Socket | null = null;
  const socketHandlers = new Map<string, Set<(data: unknown) => void>>();
  const socketOnceHandlers = new Map<string, Set<(data: unknown) => void>>();
  
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
        }
      });
      
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
          onceSocket<{ peerId: string }>('connected', (connData) => {
            const newPeerId = connData.peerId;
            const oldPeerId = currentSession.localUser.peerId;
            console.log(`[Signaling] Got new peerId: ${newPeerId} (was: ${oldPeerId})`);
            
            // Update session with new peerId
            setSession({
              ...currentSession,
              localUser: {
                ...currentSession.localUser,
                peerId: newPeerId,
              },
            });
            
            // Update our CRDT presence with new peerId
            removePeer(oldPeerId);
            addPeer(newPeerId, currentSession.localUser.username, currentSession.localUser.x, currentSession.localUser.y);
            
            // Listen for space-state to re-establish WebRTC with existing peers
            onceSocket<{ peers: Record<string, { username: string }> }>('space-state', async (stateData) => {
              console.log('[Signaling] Received space-state after reconnect, re-establishing WebRTC');
              const localStream = currentSession.localUser.stream;
              
              // Close ALL stale connections (they used old peerId)
              for (const [peerId, pc] of peerConnections.entries()) {
                console.log(`[WebRTC] Closing stale connection to ${peerId}`);
                pc.close();
              }
              peerConnections.clear();
              
              // For each peer in the space, establish a new WebRTC connection
              for (const [peerId] of Object.entries(stateData.peers)) {
                if (peerId === newPeerId) continue; // Skip ourselves
                
                console.log(`[WebRTC] Re-establishing connection to ${peerId} after reconnect`);
                const pc = createPeerConnection(peerId);
                
                if (localStream) {
                  localStream.getTracks().forEach(track => {
                    pc.addTrack(track, localStream);
                  });
                }
                
                // Also add any local screen shares
                for (const [shareId, stream] of screenShareStreams().entries()) {
                  const shareInfo = screenShares().get(shareId);
                  if (shareInfo && shareInfo.peerId === oldPeerId) {
                    // Update screen share owner to new peerId
                    stream.getTracks().forEach(track => {
                      pc.addTrack(track, stream);
                    });
                    emitSocket('screen-share-started', { peerId: newPeerId, shareId });
                  }
                }
                
                const offer = await pc.createOffer();
                await pc.setLocalDescription(offer);
                emitSocket('signal', {
                  to: peerId,
                  from: newPeerId,
                  signal: { type: 'offer', sdp: offer },
                });
              }
            });
          });
          
          socket?.emit('join-space', {
            spaceId: currentSession.spaceId,
            username: currentSession.localUser.username,
          });
        }
      });
      
      // Forward events to handlers
      const events = ['connected', 'space-info', 'space-state', 'peer-joined', 'peer-left', 'signal', 'screen-share-started', 'screen-share-stopped', 'space-activity'];
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
  }
  
  function onSocket<T>(event: string, handler: (data: T) => void) {
    if (!socketHandlers.has(event)) {
      socketHandlers.set(event, new Set());
    }
    socketHandlers.get(event)!.add(handler as (data: unknown) => void);
  }
  
  function onceSocket<T>(event: string, handler: (data: T) => void) {
    if (!socketOnceHandlers.has(event)) {
      socketOnceHandlers.set(event, new Set());
    }
    socketOnceHandlers.get(event)!.add(handler as (data: unknown) => void);
  }
  
  function triggerSocketEvent(event: string, data: unknown) {
    socketHandlers.get(event)?.forEach((h) => h(data));
    const once = socketOnceHandlers.get(event);
    if (once) {
      once.forEach((h) => h(data));
      socketOnceHandlers.delete(event);
    }
  }
  
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
        batch(() => {
          setPeers(new Map(peersMap!.entries()));
          setScreenShares(new Map(screenSharesMap!.entries()));
          setTextNotes(clonedTextNotes);
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
    
    setYdocSignal(null);
    setAwarenessSignal(null);
    setCrdtSynced(false);
  }
  
  // CRDT Mutations
  function addPeer(peerId: string, username: string, x: number, y: number) {
    peersMap?.set(peerId, { username, x, y, isMuted: false, isVideoOff: false, status: '' });
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
  
  // Media stream management
  function setScreenShareStream(shareId: string, stream: MediaStream) {
    setScreenShareStreams(prev => {
      const next = new Map(prev);
      next.set(shareId, stream);
      return next;
    });
  }
  
  function removeScreenShareStream(shareId: string) {
    setScreenShareStreams(prev => {
      const next = new Map(prev);
      const stream = next.get(shareId);
      if (stream) {
        stream.getTracks().forEach(t => t.stop());
        next.delete(shareId);
      }
      return next;
    });
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
  
  // Peer stream management
  function setPeerStream(peerId: string, stream: MediaStream) {
    setPeerStreams(prev => {
      const next = new Map(prev);
      next.set(peerId, stream);
      return next;
    });
  }
  
  function removePeerStream(peerId: string) {
    setPeerStreams(prev => {
      const next = new Map(prev);
      next.delete(peerId);
      return next;
    });
  }
  
  // WebRTC initialization - sets up signal handlers for peer connections
  // Note: Full WebRTC peer connection management is complex and involves:
  // - ICE servers, offer/answer exchange, track handling
  // For now this sets up the signal handler infrastructure
  const peerConnections = new Map<string, RTCPeerConnection>();
  // Track known webcam stream IDs per peer (first video stream from each peer)
  const peerWebcamStreamIds = new Map<string, string>();
  // Track pending screen share IDs per peer (set by screen-share-started event)
  const pendingScreenShareIds = new Map<string, string[]>();
  
  /**
   * Add screen share tracks to all existing peer connections.
   * This triggers renegotiation to send the screen share stream to peers.
   */
  async function addScreenShareToPeers(stream: MediaStream) {
    console.log(`[WebRTC] Adding screen share to ${peerConnections.size} peer connections`);
    
    for (const [peerId, pc] of peerConnections.entries()) {
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
          from: session()?.localUser.peerId,
          signal: { type: 'offer', sdp: offer },
        });
      } catch (e) {
        console.error(`[WebRTC] Failed to renegotiate with ${peerId}:`, e);
      }
    }
  }
  
  function initWebRTC() {
    // Handle incoming signals
    onSocket<{ from: string; signal: { type: string; sdp?: RTCSessionDescriptionInit; candidate?: RTCIceCandidateInit } }>('signal', async (data) => {
      const { from, signal } = data;
      
      let pc = peerConnections.get(from);
      if (!pc) {
        pc = createPeerConnection(from);
      }
      
      if (signal.type === 'offer' && signal.sdp) {
        // Before setting remote description, add our local tracks so they are included in the answer
        const localStream = session()?.localUser.stream;
        if (localStream) {
          const senders = pc.getSenders();
          const existingTrackIds = new Set(senders.map(s => s.track?.id).filter(Boolean));
          localStream.getTracks().forEach(track => {
            if (!existingTrackIds.has(track.id)) {
              console.log(`[WebRTC] Adding local track to answer for ${from}: ${track.kind}`);
              pc.addTrack(track, localStream);
            }
          });
        }
        
        await pc.setRemoteDescription(new RTCSessionDescription(signal.sdp));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        emitSocket('signal', {
          to: from,
          from: session()?.localUser.peerId,
          signal: { type: 'answer', sdp: answer },
        });
      } else if (signal.type === 'answer' && signal.sdp) {
        await pc.setRemoteDescription(new RTCSessionDescription(signal.sdp));
      } else if (signal.type === 'candidate' && signal.candidate) {
        await pc.addIceCandidate(new RTCIceCandidate(signal.candidate));
      }
    });
    
    // When a new peer joins, initiate connection
    onSocket<{ peerId: string; username: string }>('peer-joined', async (data) => {
      const { peerId } = data;
      const pc = createPeerConnection(peerId);
      
      // Add local webcam tracks
      const localStream = session()?.localUser.stream;
      if (localStream) {
        localStream.getTracks().forEach(track => {
          pc.addTrack(track, localStream);
        });
      }
      
      // Add any existing local screen share tracks
      // This ensures late-joiners receive screen shares that were started before they joined
      for (const [shareId, stream] of screenShareStreams().entries()) {
        // Only add if this is our own screen share
        const shareInfo = screenShares().get(shareId);
        if (shareInfo && shareInfo.peerId === session()?.localUser.peerId) {
          stream.getTracks().forEach(track => {
            console.log(`[WebRTC] Adding existing screen share track to new peer ${peerId}: ${track.kind}`);
            pc.addTrack(track, stream);
          });
          // Emit screen-share-started so the new peer can match the track to the shareId
          emitSocket('screen-share-started', {
            peerId: session()?.localUser.peerId,
            shareId,
          });
        }
      }
      
      // Create and send offer
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      emitSocket('signal', {
        to: peerId,
        from: session()?.localUser.peerId,
        signal: { type: 'offer', sdp: offer },
      });
    });
    
    // When a peer leaves, close connection
    onSocket<{ peerId: string }>('peer-left', (data) => {
      const pc = peerConnections.get(data.peerId);
      if (pc) {
        pc.close();
        peerConnections.delete(data.peerId);
      }
      removePeerStream(data.peerId);
      peerWebcamStreamIds.delete(data.peerId);
      pendingScreenShareIds.delete(data.peerId);
    });
    
    // Track incoming screen share announcements to know which streams are screen shares
    onSocket<{ peerId: string; shareId: string; username: string }>('screen-share-started', (data) => {
      console.log(`[WebRTC] Screen share started from ${data.peerId}: ${data.shareId}`);
      if (!pendingScreenShareIds.has(data.peerId)) {
        pendingScreenShareIds.set(data.peerId, []);
      }
      pendingScreenShareIds.get(data.peerId)!.push(data.shareId);
    });
  }
  
  function createPeerConnection(peerId: string): RTCPeerConnection {
    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
      ],
    });
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
      if (!stream) return;
      
      console.log(`[WebRTC] Received track from ${peerId}: kind=${event.track.kind}, stream=${stream.id}`);
      
      if (event.track.kind === 'video') {
        // FIRST check if there's a pending screen share for this peer
        // This handles the case where screen share arrives before webcam or without webcam
        const pendingIds = pendingScreenShareIds.get(peerId);
        if (pendingIds && pendingIds.length > 0) {
          // This is a screen share!
          const shareId = pendingIds.shift()!;
          console.log(`[WebRTC] Video stream from ${peerId} is screen share: ${shareId}`);
          setScreenShareStream(shareId, stream);
          return;
        }
        
        const knownWebcamId = peerWebcamStreamIds.get(peerId);
        
        if (!knownWebcamId) {
          // First video stream from this peer with no pending screen share = webcam
          console.log(`[WebRTC] First video stream from ${peerId}, treating as webcam`);
          peerWebcamStreamIds.set(peerId, stream.id);
          setPeerStream(peerId, stream);
        } else if (stream.id === knownWebcamId) {
          // Same webcam stream, update it
          console.log(`[WebRTC] Same webcam stream from ${peerId}, updating`);
          setPeerStream(peerId, stream);
        } else {
          // Different stream without pending ID - treat as unknown screen share
          const shareId = `${peerId}-${stream.id}`;
          console.warn(`[WebRTC] Unknown video stream from ${peerId}, treating as screen share: ${shareId}`);
          setScreenShareStream(shareId, stream);
        }
      } else {
        // Audio track - associate with webcam stream
        setPeerStream(peerId, stream);
      }
    };
    
    pc.onconnectionstatechange = () => {
      console.log(`[WebRTC] Connection with ${peerId}: ${pc.connectionState}`);
      if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
        pc.close();
        peerConnections.delete(peerId);
        removePeerStream(peerId);
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
    participantCount,
    spaceId,
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
    screenShareStreams,
    setScreenShareStream,
    removeScreenShareStream,
    addScreenShareToPeers,
    peerStreams,
    setPeerStream,
    removePeerStream,
    initWebRTC,
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

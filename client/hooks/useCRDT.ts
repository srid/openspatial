/**
 * useCRDT - Bridges Yjs CRDT observers to SolidJS reactive signals
 * 
 * This hook connects to the y-websocket server and exposes CRDT state
 * as fine-grained SolidJS signals that update automatically on document changes.
 */
import { createSignal, onCleanup, Accessor } from 'solid-js';
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';
import { useSpace } from '@/context/SpaceContext';
import type { PeerState, ScreenShareState, TextNoteState } from '../../shared/yjs-schema';

export interface CRDTBridge {
  // Connection state
  synced: Accessor<boolean>;
  
  // Raw Yjs references (for mutations)
  doc: Y.Doc | null;
  peersMap: Y.Map<PeerState> | null;
  screenSharesMap: Y.Map<ScreenShareState> | null;
  textNotesMap: Y.Map<TextNoteState> | null;
  
  // Mutation helpers
  addPeer: (peerId: string, username: string, x: number, y: number) => void;
  removePeer: (peerId: string) => void;
  updatePosition: (peerId: string, x: number, y: number) => void;
  updateMediaState: (peerId: string, isMuted: boolean, isVideoOff: boolean) => void;
  updateStatus: (peerId: string, status: string) => void;
  
  // Screen share mutations
  addScreenShare: (shareId: string, peerId: string, username: string, x: number, y: number, width: number, height: number) => void;
  removeScreenShare: (shareId: string) => void;
  updateScreenSharePosition: (shareId: string, x: number, y: number) => void;
  updateScreenShareSize: (shareId: string, width: number, height: number) => void;
  
  // Text note mutations
  addTextNote: (noteId: string, content: string, x: number, y: number, width: number, height: number, fontSize?: 'small' | 'medium' | 'large', fontFamily?: 'sans' | 'serif' | 'mono', color?: string) => void;
  removeTextNote: (noteId: string) => void;
  updateTextNotePosition: (noteId: string, x: number, y: number) => void;
  updateTextNoteSize: (noteId: string, width: number, height: number) => void;
  updateTextNoteContent: (noteId: string, content: string) => void;
  updateTextNoteStyle: (noteId: string, fontSize: 'small' | 'medium' | 'large', fontFamily: 'sans' | 'serif' | 'mono', color: string) => void;
  
  // Lifecycle
  connect: (spaceId: string) => void;
  disconnect: () => void;
}

export function useCRDT(): CRDTBridge {
  const { setPeers, setScreenShares, setTextNotes } = useSpace();
  
  const [synced, setSynced] = createSignal(false);
  
  let doc: Y.Doc | null = null;
  let provider: WebsocketProvider | null = null;
  let peersMap: Y.Map<PeerState> | null = null;
  let screenSharesMap: Y.Map<ScreenShareState> | null = null;
  let textNotesMap: Y.Map<TextNoteState> | null = null;
  
  function connect(spaceId: string) {
    // Clean up any existing connection
    disconnect();
    
    doc = new Y.Doc();
    
    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${wsProtocol}//${window.location.host}/yjs`;
    provider = new WebsocketProvider(wsUrl, spaceId, doc);
    
    peersMap = doc.getMap<PeerState>('peers');
    screenSharesMap = doc.getMap<ScreenShareState>('screenShares');
    textNotesMap = doc.getMap<TextNoteState>('textNotes');
    
    // Bridge Yjs observers to SolidJS signals
    peersMap.observe(() => {
      setPeers(new Map(peersMap!.entries()));
    });
    
    screenSharesMap.observe(() => {
      setScreenShares(new Map(screenSharesMap!.entries()));
    });
    
    textNotesMap.observe(() => {
      setTextNotes(new Map(textNotesMap!.entries()));
    });
    
    provider.on('status', ({ status }: { status: string }) => {
      console.log(`[CRDT] Connection status: ${status}`);
    });
    
    provider.on('synced', ({ synced: s }: { synced: boolean }) => {
      console.log(`[CRDT] Synced: ${s}, peers: ${peersMap?.size}`);
      setSynced(s);
      
      // Trigger initial state update after sync
      if (s) {
        setPeers(new Map(peersMap!.entries()));
        setScreenShares(new Map(screenSharesMap!.entries()));
        setTextNotes(new Map(textNotesMap!.entries()));
      }
    });
  }
  
  function disconnect() {
    provider?.disconnect();
    provider?.destroy();
    doc?.destroy();
    
    doc = null;
    provider = null;
    peersMap = null;
    screenSharesMap = null;
    textNotesMap = null;
    
    setSynced(false);
  }
  
  onCleanup(() => disconnect());
  
  // Peer mutations
  const addPeer = (peerId: string, username: string, x: number, y: number) => {
    peersMap?.set(peerId, {
      username,
      x,
      y,
      isMuted: false,
      isVideoOff: false,
      status: ''
    });
  };
  
  const removePeer = (peerId: string) => {
    peersMap?.delete(peerId);
  };
  
  const updatePosition = (peerId: string, x: number, y: number) => {
    const peer = peersMap?.get(peerId);
    if (peer) {
      peersMap?.set(peerId, { ...peer, x, y });
    }
  };
  
  const updateMediaState = (peerId: string, isMuted: boolean, isVideoOff: boolean) => {
    const peer = peersMap?.get(peerId);
    if (peer) {
      peersMap?.set(peerId, { ...peer, isMuted, isVideoOff });
    }
  };
  
  const updateStatus = (peerId: string, status: string) => {
    const peer = peersMap?.get(peerId);
    if (peer) {
      peersMap?.set(peerId, { ...peer, status });
    }
  };
  
  // Screen share mutations
  const addScreenShare = (shareId: string, peerId: string, username: string, x: number, y: number, width: number, height: number) => {
    screenSharesMap?.set(shareId, { peerId, username, x, y, width, height });
  };
  
  const removeScreenShare = (shareId: string) => {
    screenSharesMap?.delete(shareId);
  };
  
  const updateScreenSharePosition = (shareId: string, x: number, y: number) => {
    const share = screenSharesMap?.get(shareId);
    if (share) {
      screenSharesMap?.set(shareId, { ...share, x, y });
    }
  };
  
  const updateScreenShareSize = (shareId: string, width: number, height: number) => {
    const share = screenSharesMap?.get(shareId);
    if (share) {
      screenSharesMap?.set(shareId, { ...share, width, height });
    }
  };
  
  // Text note mutations
  const addTextNote = (
    noteId: string,
    content: string,
    x: number,
    y: number,
    width: number,
    height: number,
    fontSize: 'small' | 'medium' | 'large' = 'medium',
    fontFamily: 'sans' | 'serif' | 'mono' = 'sans',
    color: string = '#ffffff'
  ) => {
    textNotesMap?.set(noteId, { content, x, y, width, height, fontSize, fontFamily, color });
  };
  
  const removeTextNote = (noteId: string) => {
    textNotesMap?.delete(noteId);
  };
  
  const updateTextNotePosition = (noteId: string, x: number, y: number) => {
    const note = textNotesMap?.get(noteId);
    if (note) {
      textNotesMap?.set(noteId, { ...note, x, y });
    }
  };
  
  const updateTextNoteSize = (noteId: string, width: number, height: number) => {
    const note = textNotesMap?.get(noteId);
    if (note) {
      textNotesMap?.set(noteId, { ...note, width, height });
    }
  };
  
  const updateTextNoteContent = (noteId: string, content: string) => {
    const note = textNotesMap?.get(noteId);
    if (note) {
      textNotesMap?.set(noteId, { ...note, content });
    }
  };
  
  const updateTextNoteStyle = (noteId: string, fontSize: 'small' | 'medium' | 'large', fontFamily: 'sans' | 'serif' | 'mono', color: string) => {
    const note = textNotesMap?.get(noteId);
    if (note) {
      textNotesMap?.set(noteId, { ...note, fontSize, fontFamily, color });
    }
  };
  
  return {
    synced,
    get doc() { return doc; },
    get peersMap() { return peersMap; },
    get screenSharesMap() { return screenSharesMap; },
    get textNotesMap() { return textNotesMap; },
    addPeer,
    removePeer,
    updatePosition,
    updateMediaState,
    updateStatus,
    addScreenShare,
    removeScreenShare,
    updateScreenSharePosition,
    updateScreenShareSize,
    addTextNote,
    removeTextNote,
    updateTextNotePosition,
    updateTextNoteSize,
    updateTextNoteContent,
    updateTextNoteStyle,
    connect,
    disconnect,
  };
}

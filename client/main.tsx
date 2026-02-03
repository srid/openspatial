/**
 * Main Entry Point - Pure SolidJS Architecture
 * 
 * Data flow:
 * - Socket events → Store actions
 * - CRDT sync → Store via crdt-bridge
 * - Components render from Store
 * - User actions → Store actions → CRDT broadcast
 */
import { render } from 'solid-js/web';
import { createEffect, onCleanup } from 'solid-js';
import { App } from './components/App';

// Store imports
import { 
  initializeSpace, 
  setConnected, 
  resetSpace,
  addParticipant,
  removeParticipant,
  updateParticipantPosition,
  setLocalStream,
  setParticipantStream,
  spaceState,
  localMedia,
  toggleMuted,
  toggleVideoOff,
  participantCount,
} from './store/space';

import {
  connectCRDT,
  disconnectCRDT,
  addLocalPeerToCRDT,
  broadcastPosition,
  broadcastMediaState,
} from './store/crdt-bridge';

// Legacy modules that still need refactoring but work for now
import { SocketHandler } from './modules/socket';
import { WebRTCManager } from './modules/webrtc';
import { CRDTManager } from './modules/crdt';
import { SpatialAudio } from './modules/spatial-audio';

// Route state
import { route, setRoute, setJoinError } from './store/app';

// ==================== Module Instances ====================

const socket = new SocketHandler();
const spatialAudio = new SpatialAudio();

let webrtc: WebRTCManager | null = null;
let crdt: CRDTManager | null = null;

// ==================== Socket Event Handlers ====================

function setupSocketEvents(): void {
  socket.on('connected', handleConnected);
  socket.on('space-state', handleSpaceState);
  socket.on('peer-joined', handlePeerJoined);
  socket.on('peer-left', handlePeerLeft);
  socket.on('signal', handleSignal);
  
  socket.onConnectionStateChange((state) => {
    if (state === 'disconnected') {
      console.log('[Socket] Disconnected');
    } else if (state === 'connected') {
      console.log('[Socket] Connected');
    }
  });
}

function handleConnected(data: { peerId: string }): void {
  console.log('[Main] Connected with peerId:', data.peerId);
  
  // Update store
  setConnected(data.peerId);
  
  // Create local avatar at center
  const centerX = 2000;
  const centerY = 2000;
  
  addParticipant({
    id: data.peerId,
    username: spaceState.username,
    position: { x: centerX, y: centerY },
    isMuted: localMedia.isMuted,
    isVideoOff: localMedia.isVideoOff,
    isSpeaking: false,
    status: '',
    stream: localMedia.localStream ?? undefined,
  });
  
  // Add to CRDT
  addLocalPeerToCRDT(centerX, centerY);
  
  // Update URL and title
  history.replaceState(null, '', `/s/${encodeURIComponent(spaceState.spaceId)}`);
  document.title = `${spaceState.spaceId} - OpenSpatial`;
}

function handleSpaceState(data: { peers: Record<string, any> }): void {
  console.log('[Main] Received space state:', Object.keys(data.peers).length, 'peers');
  
  const localId = spaceState.localPeerId;
  
  for (const [peerId, peerData] of Object.entries(data.peers)) {
    if (peerId === localId) {
      // Update local position from server
      updateParticipantPosition(peerId, peerData.position.x, peerData.position.y);
    } else {
      // Add remote peer
      addParticipant({
        id: peerId,
        username: peerData.username,
        position: peerData.position,
        isMuted: peerData.isMuted ?? false,
        isVideoOff: peerData.isVideoOff ?? false,
        isSpeaking: false,
        status: peerData.status ?? '',
      });
      
      // Create WebRTC connection
      webrtc?.createPeerConnection(peerId, true);
    }
  }
}

function handlePeerJoined(data: { peerId: string; username: string; position: { x: number; y: number } }): void {
  console.log('[Main] Peer joined:', data.peerId, data.username);
  
  addParticipant({
    id: data.peerId,
    username: data.username,
    position: data.position,
    isMuted: false,
    isVideoOff: false,
    isSpeaking: false,
    status: '',
  });
}

function handlePeerLeft(data: { peerId: string }): void {
  console.log('[Main] Peer left:', data.peerId);
  removeParticipant(data.peerId);
  webrtc?.closePeerConnection(data.peerId);
}

function handleSignal(data: any): void {
  webrtc?.handleSignal(data);
}

// ==================== Join/Leave Handlers ====================

async function handleJoinSpace(spaceId: string, username: string): Promise<void> {
  console.log('[Main] Joining space:', spaceId, 'as', username);
  
  // Initialize store
  initializeSpace(spaceId, username);
  
  try {
    // Get media stream
    const constraints: MediaStreamConstraints = {
      video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
      audio: true,
    };
    
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia(constraints);
    } catch (err) {
      const error = err as DOMException;
      console.error('[Main] getUserMedia error:', error.name);
      
      if (error.name === 'OverconstrainedError') {
        stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      } else {
        setJoinError(`Camera/microphone error: ${error.name}`);
        return;
      }
    }
    
    setLocalStream(stream);
    
    // Update route to show space
    setRoute({ type: 'space', spaceId });
    
    // Initialize WebRTC - create a minimal state object matching WebRTCAppState
    const webrtcState = {
      peerId: null as string | null,
      localStream: stream,
      screenStreams: new Map<string, MediaStream>(),
      pendingShareIds: new Map<string, any[]>(),
      peers: new Map<string, any>(),
    };
    webrtc = new WebRTCManager(socket, webrtcState);
    await webrtc.init();
    // Note: WebRTCManager.handleVideoTrack calls avatars.setRemoteStream internally
    // For pure store architecture, we'd refactor WebRTCManager to emit events instead
    
    // Initialize CRDT
    crdt = new CRDTManager(spaceId);
    connectCRDT(crdt);
    
    // Connect socket
    await socket.connect();
    socket.emit('join-space', { username, spaceId });
    
  } catch (error) {
    console.error('[Main] Failed to join:', error);
    setJoinError('Failed to connect. Please try again.');
  }
}

function handleLeaveSpace(): void {
  console.log('[Main] Leaving space');
  
  // Stop media tracks
  localMedia.localStream?.getTracks().forEach(track => track.stop());
  
  // Clean up
  disconnectCRDT();
  crdt?.destroy();
  crdt = null;
  
  webrtc?.closeAllConnections();
  webrtc = null;
  
  socket.disconnect();
  
  // Reset store
  resetSpace();
  
  // Go back to landing
  setRoute({ type: 'landing' });
  document.title = 'OpenSpatial - Virtual Office';
}

// ==================== Media Controls ====================

function handleToggleMic(): void {
  toggleMuted();
  broadcastMediaState();
}

function handleToggleCamera(): void {
  toggleVideoOff();
  broadcastMediaState();
}

function handleToggleScreen(): void {
  console.log('[Main] Screen share - not yet implemented in pure store');
}

function handleAddNote(): void {
  console.log('[Main] Add note - not yet implemented in pure store');
}

// ==================== Initial Route ====================

function handleInitialRoute(): void {
  const pathMatch = window.location.pathname.match(/^\/s\/(.+)$/);
  if (pathMatch) {
    const spaceId = decodeURIComponent(pathMatch[1]);
    document.title = `${spaceId} - OpenSpatial`;
    setRoute({ type: 'join', spaceId });
  } else {
    setRoute({ type: 'landing' });
  }
}

// ==================== Bootstrap ====================

setupSocketEvents();
handleInitialRoute();

render(() => (
  <App
    onJoinSpace={handleJoinSpace}
    onLeaveSpace={handleLeaveSpace}
    onToggleMic={handleToggleMic}
    onToggleCamera={handleToggleCamera}
    onToggleScreen={handleToggleScreen}
    onAddNote={handleAddNote}
  />
), document.getElementById('app')!);

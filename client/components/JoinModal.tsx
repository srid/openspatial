/**
 * JoinModal Component
 * Handles joining a space with username input.
 */
import { Component, createSignal, onMount, Show } from 'solid-js';
import { useSpace, getSpaceIdFromUrl } from '@/context/SpaceContext';
import type { ConnectedEvent, SpaceInfoEvent, SpaceStateEvent } from '../../shared/types/events';

const STORAGE_KEY_USERNAME = 'openspatial-username';

export const JoinModal: Component = () => {
  const ctx = useSpace();
  
  const [username, setUsername] = createSignal('');
  const [spaceId, setSpaceId] = createSignal('');
  const [participants, setParticipants] = createSignal<string[]>([]);
  const [loading, setLoading] = createSignal(true);
  const [error, setError] = createSignal<string | null>(null);
  const [spaceExists, setSpaceExists] = createSignal(true);
  const [stream, setStream] = createSignal<MediaStream | null>(null);
  
  onMount(() => {
    const urlSpaceId = getSpaceIdFromUrl();
    if (urlSpaceId) {
      setSpaceId(urlSpaceId);
      document.title = `${urlSpaceId} - OpenSpatial`;
      querySpaceInfo(urlSpaceId);
    }
    
    const savedUsername = localStorage.getItem(STORAGE_KEY_USERNAME);
    if (savedUsername) {
      setUsername(savedUsername);
    }
  });
  
  async function querySpaceInfo(space: string) {
    setLoading(true);
    try {
      await ctx.connectSignaling();
      
      ctx.onceSocket<SpaceInfoEvent>('space-info', (data) => {
        if (!data.exists) {
          setSpaceExists(false);
          setError(`Space "${space}" doesn't exist. An admin needs to create it first.`);
        } else {
          setParticipants(data.participants || []);
        }
        setLoading(false);
        // DON'T disconnect here - keep connection for joining
      });
      
      ctx.emitSocket('get-space-info', { spaceId: space });
    } catch (e) {
      console.error('Failed to query space info:', e);
      setLoading(false);
    }
  }
  
  async function handleSubmit(e: Event) {
    e.preventDefault();
    setError(null);
    
    const name = username().trim();
    const space = spaceId().trim();
    
    if (!name || !space) return;
    
    localStorage.setItem(STORAGE_KEY_USERNAME, name);
    
    try {
      // Get media stream
      let mediaStream = stream();
      if (!mediaStream) {
        try {
          mediaStream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
            audio: true,
          });
          setStream(mediaStream);
        } catch (mediaErr) {
          const err = mediaErr as DOMException;
          if (err.name === 'NotAllowedError') {
            setError('Camera/microphone access denied. Please grant permission and try again.');
          } else {
            setError(`Media error: ${err.name}`);
          }
          return;
        }
      }
      
      // Ensure signaling is connected
      await ctx.connectSignaling();
      
      // Wait for connected event with peerId, then wait for space-state with server-assigned position
      ctx.onceSocket<ConnectedEvent>('connected', (connData) => {
        const peerId = connData.peerId;
        
        // Wait for space-state which contains our server-assigned position
        ctx.onceSocket<SpaceStateEvent>('space-state', (stateData) => {
          // Get our server-assigned position from space-state
          const myPeerData = stateData.peers[peerId];
          const spawnX = myPeerData?.position?.x ?? 2000;
          const spawnY = myPeerData?.position?.y ?? 2000;
          
          // Connect CRDT and add ourselves with server-assigned position
          ctx.connectCRDT(space);
          ctx.addPeer(peerId, name, spawnX, spawnY);
          
          // Set session state with server-assigned position
          ctx.setSession({
            spaceId: space,
            localUser: {
              peerId,
              username: name,
              x: spawnX,
              y: spawnY,
              isMuted: false,
              isVideoOff: false,
              status: '',
              stream: mediaStream,
            },
          });
          
          // Initialize WebRTC for peer connections
          ctx.initWebRTC();
          
          // Update URL and switch view
          history.replaceState(null, '', `/s/${encodeURIComponent(space)}`);
          document.title = `${space} - OpenSpatial`;
          ctx.setView('space');
        });
      });
      
      // Join the space
      ctx.emitSocket('join-space', { spaceId: space, username: name });
    } catch (e) {
      const err = e as Error;
      console.error('Failed to join:', err);
      setError(`Failed to connect: ${err.message}`);
    }
  }
  
  return (
    <div id="join-modal" class="modal">
      <div class="modal-content">
        <div class="modal-header">
          <div class="logo">
            <img src="/logo.svg" alt="OpenSpatial" class="logo-icon" />
            <h1>OpenSpatial</h1>
          </div>
          <p class="tagline">A virtual space where distance disappears</p>
        </div>
        
        {/* Space Info */}
        <div id="space-info-preview" class="space-info-preview">
          <div class="space-name-display">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
              <polyline points="9 22 9 12 15 12 15 22" />
            </svg>
            <span id="space-name-label">{spaceId() || 'Loading...'}</span>
          </div>
          <div id="space-participants" class="space-participants">
            <Show when={loading()}>
              <svg class="spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 12a9 9 0 1 1-6.219-8.56" />
              </svg>
              <span>Checking who's here...</span>
            </Show>
            <Show when={!loading() && spaceExists()}>
              <Show when={participants().length === 0}>
                <span>No one here yet — be the first!</span>
              </Show>
              <Show when={participants().length > 0}>
                <span>{participants().length === 1 ? 'Here now:' : `${participants().length} people here:`}</span>
                <div class="participant-list">
                  {participants().map((name) => (
                    <span class="participant-name">{name}</span>
                  ))}
                </div>
              </Show>
            </Show>
          </div>
        </div>
        
        {/* Error Message */}
        <Show when={error()}>
          <div id="join-error" class="join-error">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <span>{error()}</span>
          </div>
        </Show>
        
        <form id="join-form" onSubmit={handleSubmit}>
          <input type="hidden" id="space-id" value={spaceId()} />
          <div class="form-group">
            <label for="username">Your Name</label>
            <input
              type="text"
              id="username"
              placeholder="Enter your name"
              required
              autocomplete="off"
              value={username()}
              onInput={(e) => setUsername(e.currentTarget.value)}
            />
          </div>
          <button type="submit" class="btn btn-primary" disabled={!spaceExists()}>
            <span>Join Space</span>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </button>
        </form>
        <a href="/" class="back-link">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
          <span>Back to home</span>
        </a>
      </div>
    </div>
  );
};

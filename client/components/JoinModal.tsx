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
    <div id="join-modal" class="fixed inset-0 flex items-center justify-center bg-black/80 backdrop-blur-[8px] z-[1000] animate-fade-in">
      <div class="bg-bg-elevated border border-border rounded-2xl p-10 w-full max-w-[420px] backdrop-blur-[20px] shadow-[var(--shadow-xl),var(--shadow-glow)] animate-slide-up">
        <div class="text-center mb-8">
          <div class="flex items-center justify-center gap-3 mb-2">
            <img src="/logo.svg" alt="OpenSpatial" class="w-12 h-12 animate-float" />
            <h1 class="text-[2rem] font-bold bg-[linear-gradient(135deg,#6366f1_0%,#8b5cf6_50%,#a855f7_100%)] bg-clip-text text-transparent">OpenSpatial</h1>
          </div>
          <p class="text-text-secondary text-sm">A virtual space where distance disappears</p>
        </div>
        
        {/* Space Info */}
        <div id="space-info-preview" class="mb-6 p-4 bg-surface border border-border rounded-lg">
          <div class="flex items-center gap-2 text-lg font-semibold text-text-primary mb-3">
            <svg class="text-accent" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
              <polyline points="9 22 9 12 15 12 15 22" />
            </svg>
            <span id="space-name-label">{spaceId() || 'Loading...'}</span>
          </div>
          <div id="space-participants" class="flex items-center gap-2 mt-0 py-2 px-3 bg-accent/10 border border-accent/30 rounded-md text-sm text-text-secondary">
            <Show when={loading()}>
              <svg class="animate-spin-slow" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
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
                <div class="flex flex-wrap gap-1 mt-1">
                  {participants().map((name) => (
                    <span class="py-1 px-2 bg-accent rounded-sm text-xs font-medium text-white">{name}</span>
                  ))}
                </div>
              </Show>
            </Show>
          </div>
        </div>
        
        {/* Error Message */}
        <Show when={error()}>
          <div id="join-error" class="mb-4 py-3 px-4 bg-danger/15 border border-danger/50 rounded-md text-danger text-sm flex items-center gap-2">
            <svg class="shrink-0" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <span>{error()}</span>
          </div>
        </Show>
        
        <form id="join-form" onSubmit={handleSubmit}>
          <input type="hidden" id="space-id" value={spaceId()} />
          <div class="mb-5">
            <label for="username" class="block text-sm font-medium text-text-secondary mb-2">Your Name</label>
            <input
              type="text"
              id="username"
              placeholder="Enter your name"
              required
              autocomplete="off"
              value={username()}
              onInput={(e) => setUsername(e.currentTarget.value)}
              class="w-full py-3 px-4 bg-surface border border-border rounded-lg text-text-primary text-base font-[inherit] transition-all duration-(--transition-fast) placeholder:text-text-muted focus:outline-none focus:border-accent focus:shadow-[0_0_0_3px_var(--color-accent-glow)] read-only:bg-white/[0.02] read-only:text-text-secondary read-only:cursor-not-allowed"
            />
          </div>
          <button type="submit" class="inline-flex items-center justify-center gap-2 py-3 px-6 font-[inherit] text-base font-semibold border-none rounded-lg cursor-pointer transition-all duration-(--transition-fast) w-full p-4 bg-[linear-gradient(135deg,#6366f1_0%,#8b5cf6_50%,#a855f7_100%)] text-white shadow-[var(--shadow-md),0_0_20px_var(--color-accent-glow)] hover:-translate-y-0.5 hover:shadow-[var(--shadow-lg),0_0_30px_var(--color-accent-glow)] active:translate-y-0 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0" disabled={!spaceExists()}>
            <span>Join Space</span>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </button>
        </form>
        <a href="/" class="flex items-center justify-center gap-2 mt-4 text-text-muted text-sm no-underline transition-colors duration-(--transition-fast) hover:text-text-primary">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
          <span>Back to home</span>
        </a>
      </div>
    </div>
  );
};

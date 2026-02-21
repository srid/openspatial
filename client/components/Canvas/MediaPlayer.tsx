/**
 * MediaPlayer Component
 * Displays a synchronized YouTube video player in the space.
 * Features spatial audio (volume based on distance to local avatar).
 */
import { Component, createMemo, Show, createSignal, onMount, onCleanup, createEffect } from 'solid-js';
import { useSpace } from '@/context/SpaceContext';
import { useDraggable } from '@/hooks/useDraggable';
import { useResizable } from '@/hooks/useResizable';
import { CloseButton } from './CloseButton';
import { t } from '@/lib/i18n';

// Extend window object for YouTube API
declare global {
  interface Window {
    YT: any;
    onYouTubeIframeAPIReady: () => void;
  }
}

interface MediaPlayerProps {
  playerId: string;
}

// Helper to extract YouTube ID
function extractVideoId(url: string): string | null {
  const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([^&?]+)/);
  return match ? match[1] : null;
}

// Helper to load YouTube API
function loadYouTubeAPI(): Promise<void> {
  return new Promise((resolve) => {
    if (window.YT && window.YT.Player) {
      resolve();
      return;
    }

    if (!document.getElementById('youtube-api-script')) {
      const tag = document.createElement('script');
      tag.id = 'youtube-api-script';
      tag.src = 'https://www.youtube.com/iframe_api';
      const firstScriptTag = document.getElementsByTagName('script')[0];
      firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);
      
      window.onYouTubeIframeAPIReady = () => {
        resolve();
      };
    } else {
      // Script is already loading, modify the global callback
      if (window.onYouTubeIframeAPIReady) {
        const original = window.onYouTubeIframeAPIReady;
        window.onYouTubeIframeAPIReady = () => {
          original();
          resolve();
        };
      } else {
        // Fallback polling just in case
        const check = setInterval(() => {
          if (window.YT && window.YT.Player) {
            clearInterval(check);
            resolve();
          }
        }, 100);
      }
    }
  });
}

export const MediaPlayer: Component<MediaPlayerProps> = (props) => {
  const ctx = useSpace();
  
  let containerRef: HTMLDivElement | undefined;
  let headerRef: HTMLDivElement | undefined;
  let playerDivRef: HTMLDivElement | undefined;
  let ytPlayer: any = null;
  
  const [isReady, setIsReady] = createSignal(false);
  const [ignoreNextEvent, setIgnoreNextEvent] = createSignal(false);
  const [currentVolume, setCurrentVolume] = createSignal(100);
  
  const playerState = createMemo(() => ctx.mediaPlayers().get(props.playerId));
  const videoId = createMemo(() => {
    const state = playerState();
    return state ? extractVideoId(state.url) : null;
  });
  
  const draggable = useDraggable({
    position: () => ({ x: playerState()?.x ?? 0, y: playerState()?.y ?? 0 }),
    onMove: (x, y) => ctx.updateMediaPlayerPosition(props.playerId, x, y),
  });
  
  const resizable = useResizable({
    width: () => playerState()?.width ?? 640,
    height: () => playerState()?.height ?? 360,
    onResize: (width, height) => ctx.updateMediaPlayerSize(props.playerId, width, height),
    minWidth: 320,
    minHeight: 200,
  });
  
  onMount(async () => {
    if (containerRef && headerRef) {
      draggable.setup(headerRef);
      resizable.setup(containerRef);
    }
    
    await loadYouTubeAPI();
    
    if (playerDivRef && videoId()) {
      ytPlayer = new window.YT.Player(playerDivRef, {
        videoId: videoId(),
        playerVars: {
          autoplay: 0,
          controls: 1,
          disablekb: 0,
          fs: 0,
          rel: 0,
          modestbranding: 1
        },
        events: {
          onReady: () => setIsReady(true),
          onStateChange: handlePlayerStateChange
        }
      });
    }
  });
  
  onCleanup(() => {
    if (ytPlayer && ytPlayer.destroy) {
      ytPlayer.destroy();
    }
  });
  
  // Handle local YouTube player events emitting to CRDT
  function handlePlayerStateChange(event: any) {
    if (!isReady()) return;
    
    // Ignore events that were triggered programmatically by CRDT sync
    if (ignoreNextEvent()) {
      setIgnoreNextEvent(false);
      return;
    }

    const stateToEnum = {
      '-1': 'unstarted',
      '0': 'ended',
      '1': 'playing',
      '2': 'paused',
      '3': 'buffering',
      '5': 'video cued'
    };
    
    const isPlaying = event.data === window.YT.PlayerState.PLAYING;
    const isPaused = event.data === window.YT.PlayerState.PAUSED;
    
    if (isPlaying || isPaused) {
      const time = ytPlayer.getCurrentTime();
      ctx.updateMediaPlayerState(props.playerId, isPlaying, time);
    }
  }
  
  // Handle incoming CRDT state changes applying to local player
  createEffect(() => {
    if (!isReady() || !ytPlayer) return;
    
    const state = playerState();
    if (!state) return;
    
    try {
      const currentState = ytPlayer.getPlayerState();
      const isCurrentlyPlaying = currentState === window.YT.PlayerState.PLAYING;
      const currentTime = ytPlayer.getCurrentTime() || 0;
      
      const timeDiff = Math.abs(currentTime - state.timestamp);
      // We expect some drift over time as clients play simultaneously.
      // E.g. Date.now() - state.lastUpdatedAt + state.timestamp
      const expectedTime = state.isPlaying 
        ? state.timestamp + ((Date.now() - state.lastUpdatedAt) / 1000)
        : state.timestamp;
      
      const expectedDiff = Math.abs(currentTime - expectedTime);
      
      // If drift is significant (> 2 seconds focus on absolute seek)
      const needsSeek = expectedDiff > 2;
      
      if (state.isPlaying && !isCurrentlyPlaying) {
        setIgnoreNextEvent(true);
        ytPlayer.playVideo();
      } else if (!state.isPlaying && isCurrentlyPlaying) {
        setIgnoreNextEvent(true);
        ytPlayer.pauseVideo();
      }
      
      if (needsSeek) {
        setIgnoreNextEvent(true);
        ytPlayer.seekTo(expectedTime, true);
      }
    } catch (e) {
      console.warn("YouTube player not ready for state updates", e);
    }
  });
  
  // Spatial Audio loop
  let audioLoopId: number;
  createEffect(() => {
    if (!isReady() || !ytPlayer) return;
    
    const updateVolume = () => {
      const state = playerState();
      const localUser = ctx.session()?.localUser;
      
      if (state && localUser) {
        // Read live position from CRDT peers map
        const localPeerState = ctx.peers().get(localUser.peerId) || localUser;
        
        // Calculate center of player
        const playerCx = state.x + state.width / 2;
        const playerCy = state.y + state.height / 2;
        
        const dx = playerCx - localPeerState.x;
        const dy = playerCy - localPeerState.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        // Attenuate volume
        // Similar to useLocalMedia webRTC
        const MAX_HEARING_DISTANCE = 1500;
        const MAX_VOLUME_DISTANCE = 300;
        
        let volume = 100;
        if (distance > MAX_HEARING_DISTANCE) {
          volume = 0;
        } else if (distance > MAX_VOLUME_DISTANCE) {
          const factor = 1 - ((distance - MAX_VOLUME_DISTANCE) / (MAX_HEARING_DISTANCE - MAX_VOLUME_DISTANCE));
          volume = Math.floor(factor * factor * 100);
        }
        
        try {
          const currentVol = ytPlayer.getVolume();
          if (Math.abs(currentVol - volume) > 1) { // Only update if significantly changed
            ytPlayer.setVolume(volume);
            setCurrentVolume(volume);
          } else {
            setCurrentVolume(currentVol);
          }
        } catch (e) {
            // Ignore
        }
      }
      
      audioLoopId = requestAnimationFrame(updateVolume);
    };
    
    updateVolume();
    
    onCleanup(() => {
      cancelAnimationFrame(audioLoopId);
    });
  });
  
  return (
    <Show when={playerState()}>
      {(s) => (
        <div
          ref={containerRef}
          class="media-player absolute min-w-[320px] min-h-[200px] bg-bg-secondary border border-border rounded-xl overflow-hidden shadow-xl z-5"
          style={{
            position: 'absolute',
            left: `${s().x}px`,
            top: `${s().y}px`,
            width: `${s().width}px`,
            height: `${s().height}px`,
          }}
          data-player-id={props.playerId}
          data-volume={currentVolume()}
        >
          <div ref={headerRef} class="media-player-header flex items-center justify-between py-2 px-3 bg-bg-tertiary border-b border-border cursor-grab active:cursor-grabbing">
            <span class="media-player-title flex items-center gap-2 text-sm font-medium">
              <svg class="w-4 h-4 text-red-500" width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M21.582,6.186c-0.23-0.86-0.908-1.538-1.768-1.768C18.254,4,12,4,12,4S5.746,4,4.186,4.418 c-0.86,0.23-1.538,0.908-1.768,1.768C2,7.746,2,12,2,12s0,4.254,0.418,5.814c0.23,0.86,0.908,1.538,1.768,1.768 C5.746,20,12,20,12,20s6.254,0,7.814-0.418c0.86-0.23,1.538-0.908,1.768-1.768C22,16.254,22,12,22,12S22,7.746,21.582,6.186z M10,15.464V8.536L16,12L10,15.464z"></path>
              </svg>
              <span>{isReady() ? 'YouTube' : t('loadingYoutube')}</span>
            </span>
            <div class="flex gap-1">
              <CloseButton
                closeClass="media-player-close"
                confirmClass="media-player-confirm-delete"
                cancelClass="media-player-cancel-delete"
                title={t('removeMediaPlayer')}
                onConfirm={() => {
                  ctx.removeMediaPlayer(props.playerId);
                }}
              />
            </div>
          </div>
          <div class="media-player-content w-full h-[calc(100%-40px)] bg-black relative">
             <div ref={playerDivRef} class="w-full h-full pointer-events-auto" />
             {/* Note: iframe overlay intercepting pointer events shouldn't break dragging 
                 because dragging is handled by headerRef. Resizing is handled by resizable.ResizeHandle overlay. */}
          </div>
          <resizable.ResizeHandle />
        </div>
      )}
    </Show>
  );
};

import { Component, Show, createSignal, createMemo, on, createEffect, onMount, onCleanup } from 'solid-js';
import { useSpace } from '@/context/SpaceContext';
import { ActivityPanel } from './ActivityPanel';
import { usePictureInPicture } from '@/hooks/usePictureInPicture';
import { v4 as uuidv4 } from 'uuid';
import { t } from '@/lib/i18n';

export const ControlBar: Component = () => {
  const ctx = useSpace();
  const { openPip } = usePictureInPicture();
  
  const [isMuted, setIsMuted] = createSignal(ctx.session()?.localUser.isMuted ?? false);
  const [isVideoOff, setIsVideoOff] = createSignal(ctx.session()?.localUser.isVideoOff ?? false);
  const [activityOpen, setActivityOpen] = createSignal(false);
  const [hasUnread, setHasUnread] = createSignal(false);
  
  const localUser = createMemo(() => ctx.session()?.localUser);
  
  // Show badge when activities change while panel is closed.
  // `defer: true` skips the initial run so the badge doesn't flash on mount.
  createEffect(on(() => ctx.activities(), () => {
    if (!activityOpen()) {
      setHasUnread(true);
    }
  }, { defer: true }));
  
  onMount(() => {
    // Close activity panel when clicking elsewhere
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (activityOpen() && !target.closest('#activity-wrapper')) {
        setActivityOpen(false);
      }
    };
    document.addEventListener('click', handleClickOutside);
    
    onCleanup(() => {
      document.removeEventListener('click', handleClickOutside);
    });
  });
  
  const [mediaError, setMediaError] = createSignal<string | null>(null);
  
  async function acquireStream(): Promise<MediaStream | null> {
    setMediaError(null);
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
        audio: true,
      });
      const user = localUser();
      if (!user) return null;
      
      // Update session with the new stream
      ctx.setSession({
        ...ctx.session()!,
        localUser: { ...user, stream: mediaStream, isMuted: false, isVideoOff: false },
      });
      
      // Update CRDT state
      ctx.updatePeerMediaState(user.peerId, false, false);
      
      // Send tracks to existing peers
      await ctx.addLocalStreamToPeers(mediaStream);
      
      setIsMuted(false);
      setIsVideoOff(false);
      return mediaStream;
    } catch (e) {
      const err = e as DOMException;
      console.warn('Failed to acquire media stream:', err.name);
      if (err.name === 'NotAllowedError') {
        setMediaError(t('mediaBlockedError'));
      } else {
        setMediaError(t('mediaError', { errorName: err.name }));
      }
      // Auto-dismiss after 6 seconds
      setTimeout(() => setMediaError(null), 6000);
      return null;
    }
  }
  
  async function handleToggleMic() {
    const user = localUser();
    if (!user) return;
    
    if (!user.stream) {
      await acquireStream();
      return;
    }
    
    const audioTrack = user.stream.getAudioTracks()[0];
    if (audioTrack) {
      audioTrack.enabled = !audioTrack.enabled;
      setIsMuted(!audioTrack.enabled);
      ctx.updatePeerMediaState(user.peerId, !audioTrack.enabled, isVideoOff());
    }
  }
  
  async function handleToggleCamera() {
    const user = localUser();
    if (!user) return;
    
    if (!user.stream) {
      await acquireStream();
      return;
    }
    
    const videoTrack = user.stream.getVideoTracks()[0];
    if (videoTrack) {
      videoTrack.enabled = !videoTrack.enabled;
      setIsVideoOff(!videoTrack.enabled);
      ctx.updatePeerMediaState(user.peerId, isMuted(), !videoTrack.enabled);
    }
  }
  
  async function handleStartScreenShare() {
    try {
      const screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: false,
      });
      
      const shareId = screenStream.id;
      const user = localUser();
      if (!user) return;
      
      // Store stream in context for rendering
      ctx.setScreenShareStream(shareId, screenStream);
      
      // Add to CRDT
      ctx.addScreenShare(
        shareId,
        user.peerId,
        user.username,
        user.x + 200,
        user.y,
        640,
        360
      );
      
      // Emit socket event with peerId so server can broadcast to other peers
      ctx.emitSocket('screen-share-started', { peerId: user.peerId, shareId });
      
      // Add screen share tracks to all peer connections (triggers WebRTC renegotiation)
      await ctx.addScreenShareToPeers(screenStream, shareId);
      
      // Clean up when track ends
      screenStream.getVideoTracks()[0].onended = () => {
        ctx.removeScreenShareStream(shareId);
        ctx.removeScreenShare(shareId);
        ctx.emitSocket('screen-share-stopped', { peerId: user.peerId, shareId });
      };
    } catch (e) {
      console.log('Screen share cancelled or failed:', e);
    }
  }
  
  function handleCreateNote() {
    const user = localUser();
    if (!user) return;
    
    const noteId = uuidv4();
    const sampleMarkdown = `# Welcome\n\nThis note supports **Markdown** as well as _real-time_ collaborative editing!\n\n\`\`\`haskell\nmain = do\n  putStrLn "hello"\n\`\`\`\n`;
    ctx.addTextNote(
      noteId,
      sampleMarkdown,
      user.x + 150,
      user.y - 100,
      400,
      350
    );
  }
  
  function handleSpawnMedia() {
    const url = prompt(t('enterYoutubeUrl'));
    if (!url) return;
    
    const user = localUser();
    if (!user) return;
    
    // Quick validation
    const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([^&?]+)/);
    if (!match) {
      alert(t('invalidYoutubeUrl'));
      return;
    }
    
    const playerId = uuidv4();
    ctx.spawnMediaPlayer(
      playerId,
      url,
      user.x + 150,
      user.y - 100
    );
  }
  
  function handleToggleActivity(e: MouseEvent) {
    e.stopPropagation();
    const newState = !activityOpen();
    setActivityOpen(newState);
    if (newState) {
      setHasUnread(false);
    }
  }
  
  function handleLeave() {
    const sess = ctx.session();
    if (sess) {
      ctx.removePeer(sess.localUser.peerId);
      sess.localUser.stream?.getTracks().forEach((t) => t.stop());
    }
    
    ctx.disconnectCRDT();
    ctx.disconnectSignaling();
    ctx.setSession(null);
    ctx.setView('join');
    
    document.title = 'OpenSpatial';
  }

  // Shared base classes for control buttons
  const btnBase = 'flex items-center justify-center w-[52px] h-[52px] bg-surface border border-border rounded-xl text-text-primary cursor-pointer transition-all duration-(--transition-fast) hover:bg-surface-hover hover:-translate-y-0.5 max-[480px]:w-11 max-[480px]:h-11';
  
  return (
    <>
      {/* Media permission error toast */}
      <Show when={mediaError()}>
        <div
          class="fixed bottom-24 left-1/2 -translate-x-1/2 max-w-sm px-4 py-3 bg-danger/90 text-white text-sm rounded-xl shadow-lg z-[101] cursor-pointer backdrop-blur-sm animate-[fadeIn_0.2s_ease-out]"
          onClick={() => setMediaError(null)}
        >
          {mediaError()}
        </div>
      </Show>
      <div id="control-bar" class="fixed bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-2 p-3 bg-bg-elevated border border-border rounded-2xl backdrop-blur-[12px] shadow-xl z-[100] max-[480px]:bottom-4 max-[480px]:gap-1 max-[480px]:p-2">
        <button
          id="btn-mic"
          class={btnBase}
          classList={{ 'bg-danger/20 border-danger text-danger': isMuted(), 'muted': isMuted() }}
          title={t('toggleMicrophone')}
          onClick={handleToggleMic}
        >
          <Show when={!isMuted()}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
              <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
              <line x1="12" y1="19" x2="12" y2="23" />
              <line x1="8" y1="23" x2="16" y2="23" />
            </svg>
          </Show>
          <Show when={isMuted()}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="1" y1="1" x2="23" y2="23" />
              <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6" />
              <path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2c0 .74-.11 1.46-.32 2.14" />
              <line x1="12" y1="19" x2="12" y2="23" />
              <line x1="8" y1="23" x2="16" y2="23" />
            </svg>
          </Show>
        </button>
        
        <button
          id="btn-camera"
          class={btnBase}
          classList={{ 'bg-danger/20 border-danger text-danger': isVideoOff() }}
          title={t('toggleCamera')}
          onClick={handleToggleCamera}
        >
          <Show when={!isVideoOff()}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M23 7l-7 5 7 5V7z" />
              <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
            </svg>
          </Show>
          <Show when={isVideoOff()}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M16 16v1a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h2m5.66 0H14a2 2 0 0 1 2 2v3.34l1 1L23 7v10" />
              <line x1="1" y1="1" x2="23" y2="23" />
            </svg>
          </Show>
        </button>
        
        <button
          id="btn-screen"
          class={btnBase}
          title={t('shareScreen')}
          onClick={handleStartScreenShare}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
            <line x1="8" y1="21" x2="16" y2="21" />
            <line x1="12" y1="17" x2="12" y2="21" />
          </svg>
        </button>
        
        <button
          id="btn-note"
          class={btnBase}
          title={t('addNote')}
          onClick={handleCreateNote}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 20h9" />
            <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
          </svg>
        </button>
        
        <button
          id="btn-media"
          class={btnBase}
          title={t('addMedia')}
          onClick={handleSpawnMedia}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="2" y="4" width="20" height="16" rx="2" ry="2" />
            <polygon points="10 8 16 12 10 16 10 8" />
          </svg>
        </button>
        
        <button
          id="btn-pip"
          class={btnBase}
          title="Picture-in-Picture"
          onClick={openPip}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
            <rect x="12" y="9" width="8" height="6" rx="1" ry="1" fill="currentColor" opacity="0.3" />
          </svg>
        </button>
        
        {/* Divider */}
        <div class="w-px h-8 bg-border mx-2" />
        
        <div id="activity-wrapper" class="relative">
          <button 
            id="btn-activity" 
            class={btnBase}
            classList={{ 'bg-accent border-accent shadow-[0_0_20px_var(--color-accent-glow)]': activityOpen() }}
            title={t('recentActivity')}
            onClick={handleToggleActivity}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
            {/* Activity badge - unread indicator */}
            <span id="activity-badge" class="absolute top-2 right-2 w-2 h-2 bg-danger rounded-full shadow-[0_0_8px_var(--color-danger)] animate-pulse-badge" classList={{ 'hidden': !hasUnread() }} />
          </button>
          <ActivityPanel isOpen={activityOpen()} onClose={() => setActivityOpen(false)} />
        </div>
        
        {/* Divider */}
        <div class="w-px h-8 bg-border mx-2" />
        
        <button
          id="btn-leave"
          class={`${btnBase} bg-danger/20 border-danger text-danger hover:bg-danger/30`}
          title={t('leaveSpace')}
          onClick={handleLeave}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <polyline points="16 17 21 12 16 7" />
            <line x1="21" y1="12" x2="9" y2="12" />
          </svg>
        </button>
      </div>
    </>
  );
};

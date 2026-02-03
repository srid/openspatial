/**
 * ControlBar Component
 * Bottom control bar with mic, camera, screen share, notes, activity, and leave buttons.
 */
import { Component, Show, createSignal, createMemo, onMount, onCleanup } from 'solid-js';
import { useSpace } from '@/context/SpaceContext';
import { ActivityPanel } from './ActivityPanel';
import { v4 as uuidv4 } from 'uuid';

export const ControlBar: Component = () => {
  const ctx = useSpace();
  
  const [isMuted, setIsMuted] = createSignal(false);
  const [isVideoOff, setIsVideoOff] = createSignal(false);
  const [activityOpen, setActivityOpen] = createSignal(false);
  const [hasUnread, setHasUnread] = createSignal(false);
  
  const localUser = createMemo(() => ctx.session()?.localUser);
  
  // Listen for activity updates to show badge
  onMount(() => {
    ctx.onSocket('space-activity', () => {
      if (!activityOpen()) {
        setHasUnread(true);
      }
    });
    
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
  
  function handleToggleMic() {
    const user = localUser();
    if (!user?.stream) return;
    
    const audioTrack = user.stream.getAudioTracks()[0];
    if (audioTrack) {
      audioTrack.enabled = !audioTrack.enabled;
      setIsMuted(!audioTrack.enabled);
      ctx.updatePeerMediaState(user.peerId, !audioTrack.enabled, isVideoOff());
    }
  }
  
  function handleToggleCamera() {
    const user = localUser();
    if (!user?.stream) return;
    
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
      
      const shareId = uuidv4();
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
      
      ctx.emitSocket('screen-share-started', { shareId });
      
      // Clean up when track ends
      screenStream.getVideoTracks()[0].onended = () => {
        ctx.removeScreenShareStream(shareId);
        ctx.removeScreenShare(shareId);
        ctx.emitSocket('screen-share-stopped', { shareId });
      };
    } catch (e) {
      console.log('Screen share cancelled or failed:', e);
    }
  }
  
  function handleCreateNote() {
    const user = localUser();
    if (!user) return;
    
    const noteId = uuidv4();
    ctx.addTextNote(
      noteId,
      '',
      user.x + 150,
      user.y - 100,
      300,
      200
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
    
    document.title = 'OpenSpatial - Virtual Office';
  }
  
  return (
    <div id="control-bar">
      <button
        id="btn-mic"
        class="control-btn"
        classList={{ 'muted': isMuted() }}
        title="Toggle Microphone"
        onClick={handleToggleMic}
      >
        <Show when={!isMuted()}>
          <svg class="icon-on" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
            <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
            <line x1="12" y1="19" x2="12" y2="23" />
            <line x1="8" y1="23" x2="16" y2="23" />
          </svg>
        </Show>
        <Show when={isMuted()}>
          <svg class="icon-off" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
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
        class="control-btn"
        classList={{ 'muted': isVideoOff() }}
        title="Toggle Camera"
        onClick={handleToggleCamera}
      >
        <Show when={!isVideoOff()}>
          <svg class="icon-on" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M23 7l-7 5 7 5V7z" />
            <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
          </svg>
        </Show>
        <Show when={isVideoOff()}>
          <svg class="icon-off" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M16 16v1a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h2m5.66 0H14a2 2 0 0 1 2 2v3.34l1 1L23 7v10" />
            <line x1="1" y1="1" x2="23" y2="23" />
          </svg>
        </Show>
      </button>
      
      <button
        id="btn-screen"
        class="control-btn"
        title="Share Screen"
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
        class="control-btn"
        title="Add Note"
        onClick={handleCreateNote}
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M12 20h9" />
          <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
        </svg>
      </button>
      
      <div class="control-divider" />
      
      <div id="activity-wrapper" class="activity-wrapper">
        <button 
          id="btn-activity" 
          class="control-btn" 
          classList={{ 'active': activityOpen() }}
          title="Recent Activity"
          onClick={handleToggleActivity}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
          <Show when={hasUnread()}>
            <span id="activity-badge" class="activity-badge" />
          </Show>
        </button>
        <ActivityPanel isOpen={activityOpen()} onClose={() => setActivityOpen(false)} />
      </div>
      
      <div class="control-divider" />
      
      <button
        id="btn-leave"
        class="control-btn control-btn-danger"
        title="Leave Space"
        onClick={handleLeave}
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
          <polyline points="16 17 21 12 16 7" />
          <line x1="21" y1="12" x2="9" y2="12" />
        </svg>
      </button>
    </div>
  );
};

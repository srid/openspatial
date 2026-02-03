/**
 * ControlBar Component
 * Bottom control bar with mic, camera, screen share, notes, and leave buttons.
 */
import { Component, Show } from 'solid-js';
import { useSpace } from '@/context/SpaceContext';
import { useLocalMedia } from '@/hooks/useLocalMedia';
import { useCRDT } from '@/hooks/useCRDT';
import { useSignaling } from '@/hooks/useSignaling';
import { v4 as uuidv4 } from 'uuid';

export const ControlBar: Component = () => {
  const { session, setSession, setView } = useSpace();
  const localMedia = useLocalMedia();
  const crdt = useCRDT();
  const signaling = useSignaling();
  
  function handleToggleMic() {
    localMedia.toggleMic();
    
    const sess = session();
    if (sess) {
      crdt.updateMediaState(sess.localUser.peerId, localMedia.isMuted(), sess.localUser.isVideoOff);
      setSession({
        ...sess,
        localUser: { ...sess.localUser, isMuted: localMedia.isMuted() },
      });
    }
  }
  
  function handleToggleCamera() {
    localMedia.toggleCamera();
    
    const sess = session();
    if (sess) {
      crdt.updateMediaState(sess.localUser.peerId, sess.localUser.isMuted, localMedia.isVideoOff());
      setSession({
        ...sess,
        localUser: { ...sess.localUser, isVideoOff: localMedia.isVideoOff() },
      });
    }
  }
  
  async function handleStartScreenShare() {
    try {
      const screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: false,
      });
      
      const shareId = uuidv4();
      const sess = session();
      if (!sess) return;
      
      // Add to CRDT
      crdt.addScreenShare(
        shareId,
        sess.localUser.peerId,
        sess.localUser.username,
        sess.localUser.x + 200,
        sess.localUser.y,
        640,
        360
      );
      
      // Notify server
      signaling.emit('screen-share-started', { shareId });
      
      // Handle stream end
      screenStream.getVideoTracks()[0].onended = () => {
        crdt.removeScreenShare(shareId);
        signaling.emit('screen-share-stopped', { shareId });
      };
    } catch (e) {
      console.log('Screen share cancelled or failed:', e);
    }
  }
  
  function handleCreateNote() {
    const sess = session();
    if (!sess) return;
    
    const noteId = uuidv4();
    crdt.addTextNote(
      noteId,
      '',
      sess.localUser.x + 150,
      sess.localUser.y - 100,
      300,
      200
    );
  }
  
  function handleLeave() {
    const sess = session();
    if (sess) {
      crdt.removePeer(sess.localUser.peerId);
      crdt.disconnect();
    }
    
    localMedia.stopMedia();
    signaling.disconnect();
    
    setSession(null);
    setView('join');
    
    document.title = 'OpenSpatial - Virtual Office';
  }
  
  return (
    <div id="control-bar">
      <button
        id="btn-mic"
        class="control-btn"
        classList={{ 'muted': localMedia.isMuted() }}
        title="Toggle Microphone"
        onClick={handleToggleMic}
      >
        <Show when={!localMedia.isMuted()}>
          <svg class="icon-on" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
            <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
            <line x1="12" y1="19" x2="12" y2="23" />
            <line x1="8" y1="23" x2="16" y2="23" />
          </svg>
        </Show>
        <Show when={localMedia.isMuted()}>
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
        classList={{ 'muted': localMedia.isVideoOff() }}
        title="Toggle Camera"
        onClick={handleToggleCamera}
      >
        <Show when={!localMedia.isVideoOff()}>
          <svg class="icon-on" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M23 7l-7 5 7 5V7z" />
            <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
          </svg>
        </Show>
        <Show when={localMedia.isVideoOff()}>
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
        <button id="btn-activity" class="control-btn" title="Recent Activity">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
        </button>
        <div id="activity-panel" class="activity-panel hidden" />
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

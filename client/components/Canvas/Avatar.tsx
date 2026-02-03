/**
 * Avatar Component
 * Represents a peer in the space with video, username, and status.
 */
import { Component, createMemo, Show, createSignal, onMount, onCleanup, createEffect } from 'solid-js';
import { useSpace } from '@/context/SpaceContext';
import { useCRDT } from '@/hooks/useCRDT';

interface AvatarProps {
  peerId: string;
  isLocal: boolean;
}

export const Avatar: Component<AvatarProps> = (props) => {
  const { peers, session } = useSpace();
  const crdt = useCRDT();
  
  let avatarRef: HTMLDivElement | undefined;
  let videoRef: HTMLVideoElement | undefined;
  
  const [isDragging, setIsDragging] = createSignal(false);
  
  const peer = createMemo(() => peers().get(props.peerId));
  
  // Get stream from session for local user
  const stream = createMemo(() => {
    if (props.isLocal) {
      return session()?.localUser.stream;
    }
    // Remote streams will be set via WebRTC
    return null;
  });
  
  // Update video element when stream changes
  createEffect(() => {
    const s = stream();
    if (videoRef && s) {
      videoRef.srcObject = s;
    }
  });
  
  onMount(() => {
    if (props.isLocal && avatarRef) {
      setupDrag();
    }
  });
  
  function setupDrag() {
    if (!avatarRef || !props.isLocal) return;
    
    let startDragX = 0;
    let startDragY = 0;
    let initialX = 0;
    let initialY = 0;
    
    const handleMouseDown = (e: MouseEvent) => {
      e.stopPropagation();
      setIsDragging(true);
      startDragX = e.clientX;
      startDragY = e.clientY;
      initialX = peer()?.x ?? 0;
      initialY = peer()?.y ?? 0;
      avatarRef!.style.cursor = 'grabbing';
    };
    
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging()) return;
      e.preventDefault();
      
      const deltaX = e.clientX - startDragX;
      const deltaY = e.clientY - startDragY;
      
      const newX = initialX + deltaX;
      const newY = initialY + deltaY;
      
      crdt.updatePosition(props.peerId, newX, newY);
    };
    
    const handleMouseUp = () => {
      if (isDragging()) {
        setIsDragging(false);
        if (avatarRef) {
          avatarRef.style.cursor = 'grab';
        }
      }
    };
    
    avatarRef.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    
    // Touch events
    const handleTouchStart = (e: TouchEvent) => {
      e.stopPropagation();
      setIsDragging(true);
      startDragX = e.touches[0].clientX;
      startDragY = e.touches[0].clientY;
      initialX = peer()?.x ?? 0;
      initialY = peer()?.y ?? 0;
    };
    
    const handleTouchMove = (e: TouchEvent) => {
      if (!isDragging()) return;
      
      const deltaX = e.touches[0].clientX - startDragX;
      const deltaY = e.touches[0].clientY - startDragY;
      
      const newX = initialX + deltaX;
      const newY = initialY + deltaY;
      
      crdt.updatePosition(props.peerId, newX, newY);
    };
    
    const handleTouchEnd = () => {
      setIsDragging(false);
    };
    
    avatarRef.addEventListener('touchstart', handleTouchStart, { passive: true });
    document.addEventListener('touchmove', handleTouchMove, { passive: true });
    document.addEventListener('touchend', handleTouchEnd);
    
    onCleanup(() => {
      avatarRef?.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      avatarRef?.removeEventListener('touchstart', handleTouchStart);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleTouchEnd);
    });
  }
  
  return (
    <Show when={peer()}>
      {(p) => (
        <div
          ref={avatarRef}
          class="avatar"
          classList={{
            'local': props.isLocal,
            'dragging': isDragging(),
          }}
          style={{
            transform: `translate(${p().x}px, ${p().y}px)`,
          }}
          data-peer-id={props.peerId}
        >
          <div class="avatar-video-container">
            <video
              ref={videoRef}
              class="avatar-video"
              classList={{ 'hidden': p().isVideoOff }}
              autoplay
              playsinline
              muted={props.isLocal}
            />
            <Show when={p().isVideoOff}>
              <div class="avatar-placeholder">
                <span>{p().username.charAt(0).toUpperCase()}</span>
              </div>
            </Show>
            <Show when={p().isMuted}>
              <div class="avatar-muted-indicator">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <line x1="1" y1="1" x2="23" y2="23" />
                  <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6" />
                  <path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2c0 .74-.11 1.46-.32 2.14" />
                </svg>
              </div>
            </Show>
          </div>
          <div class="avatar-info">
            <span class="avatar-name">{p().username}</span>
            <Show when={p().status}>
              <span class="avatar-status">{p().status}</span>
            </Show>
          </div>
        </div>
      )}
    </Show>
  );
};

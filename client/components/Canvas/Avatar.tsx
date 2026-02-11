/**
 * Avatar Component
 * Represents a peer in the space with video, username, and status.
 */
import { Component, createMemo, Show, createSignal, onMount, onCleanup, createEffect } from 'solid-js';
import { useSpace } from '@/context/SpaceContext';

interface AvatarProps {
  peerId: string;
  isLocal: boolean;
}

export const Avatar: Component<AvatarProps> = (props) => {
  const ctx = useSpace();
  
  let avatarRef: HTMLDivElement | undefined;
  let videoRef: HTMLVideoElement | undefined;
  
  const [isDragging, setIsDragging] = createSignal(false);
  const [showStatusPopover, setShowStatusPopover] = createSignal(false);
  const [statusInput, setStatusInput] = createSignal('');
  let statusInputRef: HTMLInputElement | undefined;
  
  const peer = createMemo(() => ctx.peers().get(props.peerId));
  
  // Get stream from session for local user, or from peerStreams for remote
  const stream = createMemo(() => {
    if (props.isLocal) {
      return ctx.session()?.localUser.stream;
    }
    return ctx.peerStreams().get(props.peerId);
  });
  
  // Update video element when stream changes
  createEffect(() => {
    const s = stream();
    if (videoRef && s) {
      videoRef.srcObject = s;
    }
  });
  
  // Callback ref to setup drag when element is ready
  const setAvatarRef = (el: HTMLDivElement) => {
    avatarRef = el;
    if (props.isLocal && avatarRef) {
      setupDrag();
    }
  };
  
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
      e.preventDefault(); // Prevent scrolling while dragging
      
      const deltaX = e.clientX - startDragX;
      const deltaY = e.clientY - startDragY;
      
      const newX = initialX + deltaX;
      const newY = initialY + deltaY;
      
      ctx.updatePeerPosition(props.peerId, newX, newY);
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
      if (e.touches.length !== 1) return;
      e.stopPropagation();
      setIsDragging(true);
      startDragX = e.touches[0].clientX;
      startDragY = e.touches[0].clientY;
      initialX = peer()?.x ?? 0;
      initialY = peer()?.y ?? 0;
    };
    
    const handleTouchMove = (e: TouchEvent) => {
      if (!isDragging() || e.touches.length !== 1) return;
      e.preventDefault(); // Prevent scrolling while dragging
      
      const deltaX = e.touches[0].clientX - startDragX;
      const deltaY = e.touches[0].clientY - startDragY;
      
      const newX = initialX + deltaX;
      const newY = initialY + deltaY;
      
      ctx.updatePeerPosition(props.peerId, newX, newY);
    };
    
    const handleTouchEnd = () => {
      setIsDragging(false);
    };
    
    avatarRef.addEventListener('touchstart', handleTouchStart, { passive: true });
    document.addEventListener('touchmove', handleTouchMove, { passive: false });
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
          ref={setAvatarRef}
          class={`avatar absolute w-[var(--avatar-size)] h-[var(--avatar-size)] cursor-grab transition-transform duration-(--transition-fast) z-10 overflow-visible ${props.isLocal ? 'self' : ''}`}
          classList={{
            'z-15': false, // speaking state would go here
          }}
          style={{
            position: 'absolute',
            left: `${p().x}px`,
            top: `${p().y}px`,
          }}
          data-peer-id={props.peerId}
        >
          {/* Video container */}
          <div class={`avatar-video-container relative w-full h-full rounded-full overflow-hidden bg-bg-tertiary shadow-lg transition-all duration-(--transition-fast) ${props.isLocal ? 'border-3 border-accent' : 'border-3 border-border'}`}>
            <video
              ref={videoRef}
              class={`w-full h-full object-cover -scale-x-100 ${p().isVideoOff ? 'hidden' : ''}`}
              autoplay
              playsinline
              muted={props.isLocal}
            />
            <Show when={p().isVideoOff}>
              <div class="flex items-center justify-center w-full h-full bg-[linear-gradient(135deg,#6366f1_0%,#8b5cf6_50%,#a855f7_100%)] text-2xl font-bold text-white">
                <span>{p().username.charAt(0).toUpperCase()}</span>
              </div>
            </Show>
          </div>

          {/* Mute indicator */}
          <Show when={p().isMuted}>
            <div class="absolute -top-2 -right-2 flex gap-1">
              <div class="avatar-indicator muted flex items-center justify-center w-7 h-7 bg-[rgba(239,68,68,0.9)] border border-danger rounded-full backdrop-blur-[8px]">
                <svg class="w-3.5 h-3.5" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <line x1="1" y1="1" x2="23" y2="23" />
                  <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6" />
                  <path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2c0 .74-.11 1.46-.32 2.14" />
                </svg>
              </div>
            </div>
          </Show>

          {/* Name and status area */}
          <div class="avatar-info">
            <span class="avatar-name absolute -bottom-7 left-1/2 -translate-x-1/2 py-1 px-3 bg-bg-elevated border border-border rounded-full text-xs font-medium whitespace-nowrap backdrop-blur-[8px]">
              {p().username}
            </span>

            {/* Status trigger (+) button — only for local avatar without status */}
            <Show when={props.isLocal && !peer()?.status}>
              <button
                class="avatar-status-trigger flex absolute -top-5 left-1/2 -translate-x-1/2 items-center justify-center w-6 h-6 bg-bg-elevated border border-border rounded-full text-text-muted cursor-pointer backdrop-blur-[8px] transition-all duration-(--transition-fast) z-[15] hover:bg-accent hover:border-accent hover:text-white hover:scale-110 hover:shadow-[0_0_12px_var(--color-accent-glow)]"
                onClick={(e) => {
                  e.stopPropagation();
                  setStatusInput('');
                  setShowStatusPopover(true);
                }}
              >
                +
              </button>
            </Show>

            {/* Status display */}
            <Show when={peer()?.status}>
              <span
                class={`avatar-status block absolute -top-6 left-1/2 -translate-x-1/2 py-1 px-2 bg-[rgba(99,102,241,0.9)] border border-accent rounded-md text-xs font-medium text-white whitespace-nowrap max-w-[150px] overflow-hidden text-ellipsis backdrop-blur-[8px] shadow-[0_0_10px_var(--color-accent-glow)] ${props.isLocal ? 'cursor-pointer transition-all duration-(--transition-fast) hover:bg-[rgba(99,102,241,1)] hover:scale-105' : ''}`}
                onClick={(e) => {
                  if (props.isLocal) {
                    e.stopPropagation();
                    setStatusInput(peer()?.status || '');
                    setShowStatusPopover(true);
                  }
                }}
              >
                {peer()?.status}
              </span>
            </Show>
          </div>

          {/* Status popover editor */}
          <Show when={showStatusPopover()}>
            <div class="absolute -top-[60px] left-1/2 -translate-x-1/2 flex items-center gap-2 p-2 bg-bg-elevated border border-border rounded-lg backdrop-blur-[12px] shadow-[var(--shadow-xl),0_0_20px_var(--color-accent-glow)] z-[100] animate-popover-in" onClick={(e) => e.stopPropagation()}>
              <input
                ref={statusInputRef}
                type="text"
                value={statusInput()}
                onInput={(e) => setStatusInput(e.currentTarget.value)}
                placeholder="Set status..."
                autofocus
                class="status-popover-input w-40 py-2 px-3 bg-surface border border-border rounded-md text-text-primary text-sm font-[inherit] transition-all duration-(--transition-fast) placeholder:text-text-muted focus:outline-none focus:border-accent focus:shadow-[0_0_0_2px_var(--color-accent-glow)]"
              />
              <button
                class="status-popover-save flex items-center justify-center w-8 h-8 bg-accent border border-accent rounded-md text-white text-base cursor-pointer transition-all duration-(--transition-fast) hover:bg-accent/80"
                onClick={() => {
                  // Read directly from DOM in case Playwright fill() doesn't trigger onInput
                  const value = statusInputRef?.value ?? statusInput();
                  ctx.updatePeerStatus(props.peerId, value);
                  setShowStatusPopover(false);
                }}
              >
                ✓
              </button>
              <Show when={peer()?.status}>
                <button
                  class="status-popover-clear flex items-center justify-center w-8 h-8 bg-surface border border-border rounded-md text-text-secondary text-base cursor-pointer transition-all duration-(--transition-fast) hover:bg-danger/20 hover:border-danger hover:text-danger"
                  onClick={() => {
                    ctx.updatePeerStatus(props.peerId, '');
                    setShowStatusPopover(false);
                  }}
                >
                  ✕
                </button>
              </Show>
            </div>
          </Show>
        </div>
      )}
    </Show>
  );
};

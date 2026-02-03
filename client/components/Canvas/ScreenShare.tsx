/**
 * ScreenShare Component
 * Displays a screen share in the space with video stream, draggable and resizable.
 * Uses refs for drag state to avoid reactive updates during drag.
 */
import { Component, createMemo, Show, createSignal, onMount, onCleanup, createEffect } from 'solid-js';
import { useSpace } from '@/context/SpaceContext';

interface ScreenShareProps {
  shareId: string;
}

export const ScreenShare: Component<ScreenShareProps> = (props) => {
  const ctx = useSpace();
  
  let containerRef: HTMLDivElement | undefined;
  let headerRef: HTMLDivElement | undefined;
  let videoRef: HTMLVideoElement | undefined;
  
  // Use refs for drag state to avoid reactive updates
  let dragState = {
    isDragging: false,
    startX: 0,
    startY: 0,
    initialX: 0,
    initialY: 0,
  };
  
  let resizeState = {
    isResizing: false,
    startX: 0,
    startY: 0,
    initialWidth: 0,
    initialHeight: 0,
  };
  
  const [isDraggingSignal, setIsDraggingSignal] = createSignal(false);
  const [isResizingSignal, setIsResizingSignal] = createSignal(false);
  const [copySuccess, setCopySuccess] = createSignal(false);
  
  const share = createMemo(() => ctx.screenShares().get(props.shareId));
  const stream = createMemo(() => ctx.screenShareStreams().get(props.shareId));
  
  // Check if this is our own screen share
  const isLocal = createMemo(() => {
    const s = share();
    const sess = ctx.session();
    return s && sess && s.peerId === sess.localUser.peerId;
  });
  
  // Update video element when stream changes
  createEffect(() => {
    const s = stream();
    if (videoRef && s) {
      videoRef.srcObject = s;
    }
  });
  
  onMount(() => {
    if (containerRef && headerRef) {
      setupDrag();
      setupResize();
      
      // Listen for test-resize events from e2e tests
      containerRef.addEventListener('test-resize', ((e: CustomEvent) => {
        const { width, height } = e.detail;
        ctx.updateScreenShareSize(props.shareId, width, height);
      }) as EventListener);
    }
  });
  
  function setupDrag() {
    if (!headerRef) return;
    
    const handleMouseDown = (e: MouseEvent) => {
      e.stopPropagation();
      e.preventDefault();
      
      const s = share();
      if (!s) return;
      
      dragState.isDragging = true;
      dragState.startX = e.clientX;
      dragState.startY = e.clientY;
      dragState.initialX = s.x;
      dragState.initialY = s.y;
      setIsDraggingSignal(true);
    };
    
    const handleMouseMove = (e: MouseEvent) => {
      if (!dragState.isDragging) return;
      e.preventDefault();
      
      const deltaX = e.clientX - dragState.startX;
      const deltaY = e.clientY - dragState.startY;
      
      ctx.updateScreenSharePosition(props.shareId, dragState.initialX + deltaX, dragState.initialY + deltaY);
    };
    
    const handleMouseUp = () => {
      if (dragState.isDragging) {
        dragState.isDragging = false;
        setIsDraggingSignal(false);
      }
    };
    
    headerRef.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    
    onCleanup(() => {
      headerRef?.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    });
  }
  
  function setupResize() {
    if (!containerRef) return;
    
    const resizeHandle = containerRef.querySelector('.resize-handle-se') as HTMLElement;
    if (!resizeHandle) return;
    
    const handleMouseDown = (e: MouseEvent) => {
      e.stopPropagation();
      e.preventDefault();
      
      const s = share();
      if (!s) return;
      
      resizeState.isResizing = true;
      resizeState.startX = e.clientX;
      resizeState.startY = e.clientY;
      resizeState.initialWidth = s.width;
      resizeState.initialHeight = s.height;
      setIsResizingSignal(true);
    };
    
    const handleMouseMove = (e: MouseEvent) => {
      if (!resizeState.isResizing) return;
      e.preventDefault();
      
      const deltaX = e.clientX - resizeState.startX;
      const deltaY = e.clientY - resizeState.startY;
      
      const newWidth = Math.max(320, resizeState.initialWidth + deltaX);
      const newHeight = Math.max(200, resizeState.initialHeight + deltaY);
      
      ctx.updateScreenShareSize(props.shareId, newWidth, newHeight);
    };
    
    const handleMouseUp = () => {
      if (resizeState.isResizing) {
        resizeState.isResizing = false;
        setIsResizingSignal(false);
      }
    };
    
    resizeHandle.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    
    onCleanup(() => {
      resizeHandle?.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    });
  }
  
  function handleClose() {
    ctx.removeScreenShareStream(props.shareId);
    ctx.removeScreenShare(props.shareId);
    ctx.emitSocket('screen-share-stopped', { shareId: props.shareId });
  }
  
  async function handleCopySnapshot() {
    if (!videoRef) return;
    
    try {
      const canvas = document.createElement('canvas');
      canvas.width = videoRef.videoWidth;
      canvas.height = videoRef.videoHeight;
      
      const ctx2d = canvas.getContext('2d');
      if (!ctx2d) return;
      
      ctx2d.drawImage(videoRef, 0, 0);
      
      const blob = await new Promise<Blob | null>(resolve =>
        canvas.toBlob(resolve, 'image/png')
      );
      
      if (blob) {
        await navigator.clipboard.write([
          new ClipboardItem({ 'image/png': blob })
        ]);
        
        // Visual feedback
        setCopySuccess(true);
        setTimeout(() => setCopySuccess(false), 2000);
      }
    } catch (err) {
      console.error('Failed to copy snapshot:', err);
    }
  }
  
  return (
    <Show when={share()}>
      {(s) => (
        <div
          ref={containerRef}
          class="screen-share"
          classList={{ 
            'dragging': isDraggingSignal(),
            'resizing': isResizingSignal(),
          }}
          style={{
            position: 'absolute',
            left: `${s().x}px`,
            top: `${s().y}px`,
            width: `${s().width}px`,
            height: `${s().height}px`,
          }}
          data-share-id={props.shareId}
        >
          <div ref={headerRef} class="screen-share-header">
            <span class="screen-share-title">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
                <line x1="8" y1="21" x2="16" y2="21" />
                <line x1="12" y1="17" x2="12" y2="21" />
              </svg>
              <span>{isLocal() ? 'Your Screen' : `${s().username}'s Screen`}</span>
            </span>
            <div style={{ display: 'flex', gap: '4px' }}>
              <button class="screen-share-copy" onClick={handleCopySnapshot} title="Copy Snapshot">
                <Show when={!copySuccess()} fallback={
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#22c55e" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="20 6 9 17 4 12"></polyline>
                  </svg>
                }>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path>
                    <circle cx="12" cy="13" r="4"></circle>
                  </svg>
                </Show>
              </button>
              <Show when={isLocal()}>
                <button class="screen-share-close" onClick={handleClose} title="Stop sharing">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </Show>
            </div>
          </div>
          <video
            ref={videoRef}
            class="screen-share-video"
            autoplay
            playsinline
            muted
          />
          <div class="resize-handle resize-handle-se" />
        </div>
      )}
    </Show>
  );
};

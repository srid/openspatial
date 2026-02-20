/**
 * ScreenShare Component
 * Displays a screen share in the space with video stream, draggable and resizable.
 * Uses refs for drag state to avoid reactive updates during drag.
 */
import { Component, createMemo, Show, createSignal, onMount, onCleanup, createEffect } from 'solid-js';
import { useSpace } from '@/context/SpaceContext';
import { useDraggable } from '@/hooks/useDraggable';
import { useResizable } from '@/hooks/useResizable';
import { CloseButton } from './CloseButton';
import { t } from '@/lib/i18n';

interface ScreenShareProps {
  shareId: string;
}

export const ScreenShare: Component<ScreenShareProps> = (props) => {
  const ctx = useSpace();
  
  let containerRef: HTMLDivElement | undefined;
  let headerRef: HTMLDivElement | undefined;
  let videoRef: HTMLVideoElement | undefined;
  
  const [copySuccess, setCopySuccess] = createSignal(false);
  
  const share = createMemo(() => ctx.screenShares().get(props.shareId));
  const stream = createMemo(() => ctx.screenShareStreams().get(props.shareId));
  
  const draggable = useDraggable({
    position: () => ({ x: share()?.x ?? 0, y: share()?.y ?? 0 }),
    onMove: (x, y) => ctx.updateScreenSharePosition(props.shareId, x, y),
  });
  
  // Resizable hook for consistent resize behavior
  const resizable = useResizable({
    width: () => share()?.width ?? 640,
    height: () => share()?.height ?? 360,
    onResize: (width, height) => ctx.updateScreenShareSize(props.shareId, width, height),
    minWidth: 320,
    minHeight: 200,
  });
  
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
      // Explicitly play to handle autoplay restrictions and ensure playback starts
      videoRef.play().catch(e => console.log('[ScreenShare] play() error:', e));
    }
  });
  
  onMount(() => {
    if (containerRef && headerRef) {
      draggable.setup(headerRef);
      resizable.setup(containerRef);
    }
  });
  

  
  // Resize is handled by useResizable hook
  

  
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
          class="screen-share absolute min-w-[320px] min-h-[200px] bg-bg-secondary border border-border rounded-xl overflow-hidden shadow-xl z-5"
          style={{
            position: 'absolute',
            left: `${s().x}px`,
            top: `${s().y}px`,
            width: `${s().width}px`,
            height: `${s().height}px`,
          }}
          data-share-id={props.shareId}
          data-local={isLocal() ? 'true' : undefined}
        >
          <div ref={headerRef} class="screen-share-header flex items-center justify-between py-2 px-3 bg-bg-tertiary border-b border-border cursor-grab active:cursor-grabbing">
            <span class="screen-share-title flex items-center gap-2 text-sm font-medium">
              <svg class="w-4 h-4 text-text-muted" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
                <line x1="8" y1="21" x2="16" y2="21" />
                <line x1="12" y1="17" x2="12" y2="21" />
              </svg>
              <span>{isLocal() ? t('yourScreen') : t('userScreen', { username: s().username })}</span>
            </span>
            <div class="flex gap-1">
              <button class="flex items-center justify-center w-6 h-6 bg-transparent border-none rounded-sm text-text-muted cursor-pointer transition-all duration-(--transition-fast) hover:bg-surface-hover hover:text-accent" onClick={handleCopySnapshot} title={t('copySnapshot')}>
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
                <CloseButton
                  closeClass="screen-share-close"
                  confirmClass="screen-share-confirm-delete"
                  cancelClass="screen-share-cancel-delete"
                  title={t('stopSharing')}
                  onConfirm={() => {
                    ctx.removeScreenShareStream(props.shareId);
                    ctx.removeScreenShare(props.shareId);
                    ctx.emitSocket('screen-share-stopped', { shareId: props.shareId });
                  }}
                />
              </Show>
            </div>
          </div>
          <video
            ref={videoRef}
            class="screen-share-video w-full h-[calc(100%-40px)] object-contain bg-black"
            autoplay
            playsinline
            muted
          />
          <resizable.ResizeHandle />
        </div>
      )}
    </Show>
  );
};

import { createMemo, For, createSignal, onMount, onCleanup } from 'solid-js';
import { useSpace } from '../context/SpaceContext';
import { t } from '@/lib/i18n';

const SPACE_WIDTH = 4000;
const SPACE_HEIGHT = 4000;
const MINIMAP_SIZE = 180;
const SCALE = MINIMAP_SIZE / Math.max(SPACE_WIDTH, SPACE_HEIGHT);

export const Minimap = () => {
  const ctx = useSpace();
  let contentRef: HTMLDivElement | undefined;
  
  const [isDragging, setIsDragging] = createSignal(false);
  
  // Get peers, screen shares, and text notes for dots
  const peers = () => Array.from(ctx.peers().values());
  const screenShares = () => Array.from(ctx.screenShares().values());
  const textNotes = () => Array.from(ctx.textNotes().values());
  
  // Reactively derive viewport from context signals (no DOM polling!)
  const viewport = createMemo(() => {
    const offset = ctx.canvasOffset();
    const scale = ctx.canvasScale();
    
    // We need the container dimensions — approximated from the window since the
    // canvas-container is always fullscreen (fixed inset-0).
    const containerWidth = typeof window !== 'undefined' ? window.innerWidth : 1920;
    const containerHeight = typeof window !== 'undefined' ? window.innerHeight : 1080;
    
    // Calculate visible area in space coordinates
    const visibleLeft = -offset.x / scale;
    const visibleTop = -offset.y / scale;
    const visibleWidth = containerWidth / scale;
    const visibleHeight = containerHeight / scale;
    
    // Convert to minimap coordinates
    const left = Math.max(0, visibleLeft) * SCALE;
    const top = Math.max(0, visibleTop) * SCALE;
    const width = Math.min(SPACE_WIDTH, visibleWidth) * SCALE;
    const height = Math.min(SPACE_HEIGHT, visibleHeight) * SCALE;
    
    return { left, top, width: Math.max(10, width), height: Math.max(10, height) };
  });
  
  function panToMinimapPosition(clientX: number, clientY: number) {
    if (!contentRef) return;
    
    const rect = contentRef.getBoundingClientRect();
    const x = (clientX - rect.left) / SCALE;
    const y = (clientY - rect.top) / SCALE;
    
    const clampedX = Math.max(0, Math.min(SPACE_WIDTH, x));
    const clampedY = Math.max(0, Math.min(SPACE_HEIGHT, y));
    
    // Center the canvas on this position via shared context signals
    const scale = ctx.canvasScale();
    const containerWidth = window.innerWidth;
    const containerHeight = window.innerHeight;
    
    let newX = containerWidth / 2 - clampedX * scale;
    let newY = containerHeight / 2 - clampedY * scale;
    
    // Clamp
    const scaledWidth = SPACE_WIDTH * scale;
    const scaledHeight = SPACE_HEIGHT * scale;
    newX = Math.max(Math.min(0, containerWidth - scaledWidth), Math.min(0, newX));
    newY = Math.max(Math.min(0, containerHeight - scaledHeight), Math.min(0, newY));
    
    ctx.setCanvasOffset({ x: newX, y: newY });
  }
  
  function handleZoom(delta?: number, reset?: boolean) {
    if (reset) {
      ctx.setCanvasScale(1);
      // Center on space center
      const containerWidth = window.innerWidth;
      const containerHeight = window.innerHeight;
      let newX = containerWidth / 2 - (SPACE_WIDTH / 2) * 1;
      let newY = containerHeight / 2 - (SPACE_HEIGHT / 2) * 1;
      // Clamp
      newX = Math.max(Math.min(0, containerWidth - SPACE_WIDTH), Math.min(0, newX));
      newY = Math.max(Math.min(0, containerHeight - SPACE_HEIGHT), Math.min(0, newY));
      ctx.setCanvasOffset({ x: newX, y: newY });
    } else if (delta) {
      const currentScale = ctx.canvasScale();
      const newScale = Math.min(Math.max(currentScale * delta, 0.25), 2);
      // Zoom from center of viewport
      const containerWidth = window.innerWidth;
      const containerHeight = window.innerHeight;
      const centerX = containerWidth / 2;
      const centerY = containerHeight / 2;
      const offset = ctx.canvasOffset();
      
      const newX = centerX - (centerX - offset.x) * (newScale / currentScale);
      const newY = centerY - (centerY - offset.y) * (newScale / currentScale);
      
      ctx.setCanvasOffset({ x: newX, y: newY });
      ctx.setCanvasScale(newScale);
      
      // Clamp
      const scaledWidth = SPACE_WIDTH * newScale;
      const scaledHeight = SPACE_HEIGHT * newScale;
      ctx.setCanvasOffset((prev) => ({
        x: Math.max(Math.min(0, containerWidth - scaledWidth), Math.min(0, prev.x)),
        y: Math.max(Math.min(0, containerHeight - scaledHeight), Math.min(0, prev.y)),
      }));
    }
  }
  
  function handleMouseDown(e: MouseEvent) {
    e.stopPropagation();
    setIsDragging(true);
    panToMinimapPosition(e.clientX, e.clientY);
  }
  
  function handleMouseMove(e: MouseEvent) {
    if (isDragging()) {
      panToMinimapPosition(e.clientX, e.clientY);
    }
  }
  
  function handleMouseUp() {
    setIsDragging(false);
  }
  
  function handleTouchStart(e: TouchEvent) {
    if (e.touches.length === 1) {
      e.stopPropagation();
      setIsDragging(true);
      const touch = e.touches[0];
      panToMinimapPosition(touch.clientX, touch.clientY);
    }
  }
  
  function handleTouchMove(e: TouchEvent) {
    if (isDragging() && e.touches.length === 1) {
      const touch = e.touches[0];
      panToMinimapPosition(touch.clientX, touch.clientY);
    }
  }
  
  function handleTouchEnd() {
    setIsDragging(false);
  }
  
  onMount(() => {
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    document.addEventListener('touchmove', handleTouchMove, { passive: true });
    document.addEventListener('touchend', handleTouchEnd);
    
    onCleanup(() => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleTouchEnd);
    });
  });
  
  // Shared button base classes for zoom controls
  const zoomBtnBase = 'minimap-btn flex-1 h-7 flex items-center justify-center bg-bg-tertiary border border-border rounded-md text-text-muted text-lg font-semibold cursor-pointer transition-all duration-(--transition-fast) hover:bg-bg-elevated hover:text-text-primary hover:border-accent';
  
  return (
    <div class="minimap fixed bottom-6 right-6 z-[100] p-3 bg-bg-elevated border border-border rounded-2xl backdrop-blur-[12px] shadow-xl max-[480px]:hidden">
      {/* Zoom controls */}
      <div class="minimap-controls flex gap-1 mb-2">
        <button 
          class={zoomBtnBase} 
          onClick={() => handleZoom(1.25)}
          title={t('zoomIn')}
        >+</button>
        <button 
          class={`${zoomBtnBase} minimap-btn-reset text-base`} 
          onClick={() => handleZoom(undefined, true)}
          title={t('resetView')}
        >⌂</button>
        <button 
          class={zoomBtnBase} 
          onClick={() => handleZoom(0.8)}
          title={t('zoomOut')}
        >−</button>
      </div>
      
      {/* Minimap content - uses scaled-down version of main canvas background */}
      <div 
        ref={contentRef}
        class="minimap-content relative w-[180px] h-[180px] border border-border rounded-lg cursor-pointer overflow-hidden"
        style={{
          background: `
            radial-gradient(ellipse 60px 40px at 10% 20%, rgba(167, 139, 250, 0.15) 0%, transparent 70%),
            radial-gradient(ellipse 50px 50px at 85% 15%, rgba(129, 230, 217, 0.12) 0%, transparent 60%),
            radial-gradient(ellipse 70px 35px at 70% 60%, rgba(253, 186, 116, 0.1) 0%, transparent 65%),
            radial-gradient(ellipse 45px 60px at 20% 75%, rgba(147, 197, 253, 0.12) 0%, transparent 60%),
            linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #1a1a2e 100%)
          `,
        }}
        onMouseDown={handleMouseDown}
        onTouchStart={handleTouchStart}
      >
        {/* Viewport rectangle */}
        <div 
          class="minimap-viewport absolute border-2 border-accent bg-accent/10 rounded-[2px] pointer-events-none"
          style={{
            left: `${viewport().left}px`,
            top: `${viewport().top}px`,
            width: `${viewport().width}px`,
            height: `${viewport().height}px`,
          }}
        />
        
        {/* Dots container */}
        <div class="absolute inset-0 pointer-events-none">
          {/* Text note rectangles (render first, behind others) */}
          <For each={textNotes()}>
            {(note) => (
              <div 
                class="absolute bg-[rgba(251,191,36,0.4)] border border-[rgba(251,191,36,0.6)] rounded-[1px]"
                style={{
                  left: `${note.x * SCALE}px`,
                  top: `${note.y * SCALE}px`,
                  width: `${Math.max(4, note.width * SCALE)}px`,
                  height: `${Math.max(3, note.height * SCALE)}px`,
                }}
              />
            )}
          </For>
          
          {/* Screen share rectangles */}
          <For each={screenShares()}>
            {(share) => (
              <div 
                class="absolute bg-success rounded-[1px] shadow-[0_0_4px_rgba(34,197,94,0.6)]"
                style={{
                  left: `${share.x * SCALE}px`,
                  top: `${share.y * SCALE}px`,
                  width: `${Math.max(4, share.width * SCALE)}px`,
                  height: `${Math.max(3, share.height * SCALE)}px`,
                }}
              />
            )}
          </For>
          
          {/* Avatar dots (render last, on top) */}
          <For each={peers()}>
            {(peer) => (
              <div 
                class="minimap-dot-avatar absolute w-1.5 h-1.5 bg-[#3b82f6] rounded-full shadow-[0_0_4px_rgba(59,130,246,0.6)] -translate-x-1/2 -translate-y-1/2"
                style={{
                  left: `${(peer.x + 60) * SCALE}px`,
                  top: `${(peer.y + 60) * SCALE}px`,
                }}
              />
            )}
          </For>
        </div>
      </div>
    </div>
  );
};

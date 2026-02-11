import { createSignal, onMount, onCleanup, For } from 'solid-js';
import { useSpace } from '../context/SpaceContext';

const SPACE_WIDTH = 4000;
const SPACE_HEIGHT = 4000;
const MINIMAP_SIZE = 180;
const SCALE = MINIMAP_SIZE / Math.max(SPACE_WIDTH, SPACE_HEIGHT);

export const Minimap = () => {
  const ctx = useSpace();
  let contentRef: HTMLDivElement | undefined;
  let animationId: number;
  
  const [viewport, setViewport] = createSignal({ left: 0, top: 0, width: 20, height: 20 });
  const [isDragging, setIsDragging] = createSignal(false);
  
  // Get peers, screen shares, and text notes for dots
  const peers = () => Array.from(ctx.peers().values());
  const screenShares = () => Array.from(ctx.screenShares().values());
  const textNotes = () => Array.from(ctx.textNotes().values());
  
  // Dispatch zoom event to Canvas
  function dispatchZoom(delta?: number, reset?: boolean) {
    const canvas = document.getElementById('canvas-container');
    if (canvas) {
      canvas.dispatchEvent(new CustomEvent('minimap-zoom', { 
        detail: { delta, reset } 
      }));
    }
  }
  
  // Parse transform from #space element
  function parseTransform(): { x: number; y: number; scale: number } {
    const space = document.getElementById('space');
    if (!space) return { x: 0, y: 0, scale: 1 };
    
    const transform = space.style.transform || '';
    const translateMatch = transform.match(/translate\(([^,]+)px,\s*([^)]+)px\)/);
    const scaleMatch = transform.match(/scale\(([^)]+)\)/);
    
    return {
      x: translateMatch ? parseFloat(translateMatch[1]) : 0,
      y: translateMatch ? parseFloat(translateMatch[2]) : 0,
      scale: scaleMatch ? parseFloat(scaleMatch[1]) : 1,
    };
  }
  
  // Update viewport rectangle by polling DOM
  function updateViewport() {
    const container = document.getElementById('canvas-container');
    if (!container) return;
    
    const containerRect = container.getBoundingClientRect();
    const { x: offsetX, y: offsetY, scale } = parseTransform();
    
    // Calculate visible area in space coordinates
    const visibleLeft = -offsetX / scale;
    const visibleTop = -offsetY / scale;
    const visibleWidth = containerRect.width / scale;
    const visibleHeight = containerRect.height / scale;
    
    // Convert to minimap coordinates
    const left = Math.max(0, visibleLeft) * SCALE;
    const top = Math.max(0, visibleTop) * SCALE;
    const width = Math.min(SPACE_WIDTH, visibleWidth) * SCALE;
    const height = Math.min(SPACE_HEIGHT, visibleHeight) * SCALE;
    
    setViewport({ left, top, width: Math.max(10, width), height: Math.max(10, height) });
  }
  
  function panToMinimapPosition(clientX: number, clientY: number) {
    if (!contentRef) return;
    
    const rect = contentRef.getBoundingClientRect();
    const x = (clientX - rect.left) / SCALE;
    const y = (clientY - rect.top) / SCALE;
    
    const clampedX = Math.max(0, Math.min(SPACE_WIDTH, x));
    const clampedY = Math.max(0, Math.min(SPACE_HEIGHT, y));
    
    // Dispatch custom event for Canvas to handle
    const canvas = document.getElementById('canvas-container');
    if (canvas) {
      canvas.dispatchEvent(new CustomEvent('minimap-pan', { 
        detail: { x: clampedX, y: clampedY } 
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
  
  function startUpdateLoop() {
    const update = () => {
      updateViewport();
      animationId = requestAnimationFrame(update);
    };
    animationId = requestAnimationFrame(update);
  }
  
  onMount(() => {
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    document.addEventListener('touchmove', handleTouchMove, { passive: true });
    document.addEventListener('touchend', handleTouchEnd);
    
    startUpdateLoop();
    
    onCleanup(() => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleTouchEnd);
      cancelAnimationFrame(animationId);
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
          onClick={() => dispatchZoom(1.25)}
          title="Zoom in"
        >+</button>
        <button 
          class={`${zoomBtnBase} minimap-btn-reset text-base`} 
          onClick={() => dispatchZoom(undefined, true)}
          title="Reset view"
        >⌂</button>
        <button 
          class={zoomBtnBase} 
          onClick={() => dispatchZoom(0.8)}
          title="Zoom out"
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

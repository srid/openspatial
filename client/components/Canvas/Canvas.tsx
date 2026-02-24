/**
 * Canvas Component
 * Interactive pan/zoom container for avatars, screen shares, and text notes.
 */
import { Component, For, createSignal, onMount, onCleanup, createMemo, createEffect } from 'solid-js';
import { useSpace } from '@/context/SpaceContext';
import { Avatar } from './Avatar';
import { ScreenShare } from './ScreenShare';
import { TextNote } from './TextNote';
import { MediaPlayer } from './MediaPlayer';
import { Minimap } from '../Minimap';

export const Canvas: Component = () => {
  const ctx = useSpace();
  
  // Create stable key arrays that only change when items are added/removed
  const peerIds = createMemo(() => [...ctx.peers().keys()], undefined, {
    equals: (a, b) => a.length === b.length && a.every((id, i) => id === b[i])
  });
  const screenShareIds = createMemo(() => [...ctx.screenShares().keys()], undefined, {
    equals: (a, b) => a.length === b.length && a.every((id, i) => id === b[i])
  });
  const textNoteIds = createMemo(() => [...ctx.textNotes().keys()], undefined, {
    equals: (a, b) => a.length === b.length && a.every((id, i) => id === b[i])
  });
  const mediaPlayerIds = createMemo(() => [...ctx.mediaPlayers().keys()], undefined, {
    equals: (a, b) => a.length === b.length && a.every((id, i) => id === b[i])
  });
  
  let containerRef: HTMLDivElement | undefined;
  let spaceRef: HTMLDivElement | undefined;
  
  const [isDragging, setIsDragging] = createSignal(false);
  const [startX, setStartX] = createSignal(0);
  const [startY, setStartY] = createSignal(0);
  
  const spaceWidth = 4000;
  const spaceHeight = 4000;
  
  const transform = createMemo(() => {
    const offset = ctx.canvasOffset();
    return `translate(${offset.x}px, ${offset.y}px) scale(${ctx.canvasScale()})`;
  });
  
  const localPeerId = createMemo(() => ctx.session()?.localUser.peerId);
  
  onMount(() => {
    if (!containerRef) return;
    
    // Center on local user's spawn position once it's known.
    // Initially center on space center as fallback.
    centerOn(spaceWidth / 2, spaceHeight / 2);
    
    let hasCentered = false;
    createEffect(() => {
      const pid = localPeerId();
      if (!pid || hasCentered) return;
      const peer = ctx.peers().get(pid);
      if (peer) {
        hasCentered = true;
        centerOn(peer.x, peer.y);
      }
    });
    
    setupPanning();
    setupZoom();
  });
  
  function centerOn(x: number, y: number) {
    if (!containerRef) return;
    const rect = containerRef.getBoundingClientRect();
    const scale = ctx.canvasScale();
    const newX = rect.width / 2 - x * scale;
    const newY = rect.height / 2 - y * scale;
    ctx.setCanvasOffset({ x: newX, y: newY });
    clampOffset();
  }
  
  function clampOffset() {
    if (!containerRef) return;
    const rect = containerRef.getBoundingClientRect();
    const scale = ctx.canvasScale();
    const scaledWidth = spaceWidth * scale;
    const scaledHeight = spaceHeight * scale;
    
    const maxOffsetX = 0;
    const minOffsetX = Math.min(0, rect.width - scaledWidth);
    const maxOffsetY = 0;
    const minOffsetY = Math.min(0, rect.height - scaledHeight);
    
    ctx.setCanvasOffset((prev) => ({
      x: Math.max(minOffsetX, Math.min(maxOffsetX, prev.x)),
      y: Math.max(minOffsetY, Math.min(maxOffsetY, prev.y)),
    }));
  }
  
  function setupPanning() {
    if (!containerRef) return;
    
    const handleMouseDown = (e: MouseEvent) => {
      if (e.target === containerRef || e.target === spaceRef) {
        setIsDragging(true);
        setStartX(e.pageX);
        setStartY(e.pageY);
        containerRef!.style.cursor = 'grabbing';
      }
    };
    
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging()) return;
      e.preventDefault();
      
      const deltaX = e.pageX - startX();
      const deltaY = e.pageY - startY();
      
      ctx.setCanvasOffset((prev) => ({ x: prev.x + deltaX, y: prev.y + deltaY }));
      clampOffset();
      
      setStartX(e.pageX);
      setStartY(e.pageY);
    };
    
    const handleMouseUp = () => {
      setIsDragging(false);
      if (containerRef) {
        containerRef.style.cursor = 'grab';
      }
    };
    
    containerRef.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    
    // Touch events
    const handleTouchStart = (e: TouchEvent) => {
      if (e.target === containerRef || e.target === spaceRef) {
        if (e.touches.length === 1) {
          setIsDragging(true);
          setStartX(e.touches[0].pageX);
          setStartY(e.touches[0].pageY);
        }
      }
    };
    
    const handleTouchMove = (e: TouchEvent) => {
      if (!isDragging() || e.touches.length !== 1) return;
      
      const deltaX = e.touches[0].pageX - startX();
      const deltaY = e.touches[0].pageY - startY();
      
      ctx.setCanvasOffset((prev) => ({ x: prev.x + deltaX, y: prev.y + deltaY }));
      clampOffset();
      
      setStartX(e.touches[0].pageX);
      setStartY(e.touches[0].pageY);
    };
    
    const handleTouchEnd = () => {
      setIsDragging(false);
    };
    
    containerRef.addEventListener('touchstart', handleTouchStart);
    document.addEventListener('touchmove', handleTouchMove);
    document.addEventListener('touchend', handleTouchEnd);
    
    onCleanup(() => {
      containerRef?.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      containerRef?.removeEventListener('touchstart', handleTouchStart);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleTouchEnd);
    });
  }
  
  function setupZoom() {
    if (!containerRef) return;
    
    const handleWheel = (e: WheelEvent) => {
      // Let text notes handle their own scrolling
      if ((e.target as HTMLElement).closest?.('.text-note')) return;
      e.preventDefault();
      
      const delta = e.deltaY > 0 ? 0.9 : 1.1;
      const currentScale = ctx.canvasScale();
      const newScale = Math.min(Math.max(currentScale * delta, 0.25), 2);
      
      const rect = containerRef!.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      
      const offset = ctx.canvasOffset();
      ctx.setCanvasOffset({
        x: mouseX - (mouseX - offset.x) * (newScale / currentScale),
        y: mouseY - (mouseY - offset.y) * (newScale / currentScale),
      });
      ctx.setCanvasScale(newScale);
      clampOffset();
    };
    
    containerRef.addEventListener('wheel', handleWheel, { passive: false });
    
    onCleanup(() => {
      containerRef?.removeEventListener('wheel', handleWheel);
    });
  }
  
  return (
    <div id="canvas-container" ref={containerRef} class="fixed inset-0 overflow-hidden cursor-grab active:cursor-grabbing">
      <div id="space" ref={spaceRef} class="absolute w-[4000px] h-[4000px] left-0 top-0 origin-top-left" style={{ transform: transform(), background: 'radial-gradient(ellipse 600px 400px at 10% 20%, rgba(167, 139, 250, 0.15) 0%, transparent 70%), radial-gradient(ellipse 500px 500px at 85% 15%, rgba(129, 230, 217, 0.12) 0%, transparent 60%), radial-gradient(ellipse 700px 350px at 70% 60%, rgba(253, 186, 116, 0.1) 0%, transparent 65%), radial-gradient(ellipse 450px 600px at 20% 75%, rgba(147, 197, 253, 0.12) 0%, transparent 60%), radial-gradient(ellipse 550px 450px at 55% 35%, rgba(249, 168, 212, 0.08) 0%, transparent 55%), radial-gradient(ellipse 400px 500px at 90% 80%, rgba(134, 239, 172, 0.1) 0%, transparent 60%), repeating-linear-gradient(0deg, transparent, transparent 99px, rgba(255, 255, 255, 0.03) 99px, rgba(255, 255, 255, 0.03) 100px), repeating-linear-gradient(90deg, transparent, transparent 99px, rgba(255, 255, 255, 0.03) 99px, rgba(255, 255, 255, 0.03) 100px), linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #1a1a2e 100%)' }}>
        {/* Avatars */}
        <For each={peerIds()}>
          {(peerId) => (
            <Avatar peerId={peerId} isLocal={peerId === localPeerId()} />
          )}
        </For>
        
        {/* Screen Shares */}
        <For each={screenShareIds()}>
          {(shareId) => (
            <ScreenShare shareId={shareId} />
          )}
        </For>
        
        {/* Text Notes */}
        <For each={textNoteIds()}>
          {(noteId) => (
            <TextNote noteId={noteId} />
          )}
        </For>
        
        {/* Media Players */}
        <For each={mediaPlayerIds()}>
          {(playerId) => (
            <MediaPlayer playerId={playerId} />
          )}
        </For>
      </div>
      
      {/* Space Info */}
      <div id="space-info" class="fixed top-4 left-4 flex items-center gap-4 py-3 px-5 bg-bg-elevated border border-border rounded-full backdrop-blur-[12px] z-[100]">
        <span id="space-name" class="font-semibold text-text-primary">{ctx.session()?.spaceId}</span>
        <span id="participant-count" class="text-sm text-text-muted">{ctx.peers().size} participant{ctx.peers().size !== 1 ? 's' : ''}</span>
      </div>
      
      {/* Minimap */}
      <Minimap />
    </div>
  );
};

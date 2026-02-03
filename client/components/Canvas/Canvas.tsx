/**
 * Canvas Component
 * Interactive pan/zoom container for avatars, screen shares, and text notes.
 */
import { Component, For, createSignal, onMount, onCleanup, createMemo } from 'solid-js';
import { useSpace } from '@/context/SpaceContext';
import { Avatar } from './Avatar';
import { ScreenShare } from './ScreenShare';
import { TextNote } from './TextNote';

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
  
  let containerRef: HTMLDivElement | undefined;
  let spaceRef: HTMLDivElement | undefined;
  
  const [isDragging, setIsDragging] = createSignal(false);
  const [startX, setStartX] = createSignal(0);
  const [startY, setStartY] = createSignal(0);
  const [scale, setScale] = createSignal(1);
  const [offsetX, setOffsetX] = createSignal(0);
  const [offsetY, setOffsetY] = createSignal(0);
  
  const spaceWidth = 4000;
  const spaceHeight = 4000;
  
  const transform = createMemo(() => 
    `translate(${offsetX()}px, ${offsetY()}px) scale(${scale()})`
  );
  
  const localPeerId = createMemo(() => ctx.session()?.localUser.peerId);
  
  onMount(() => {
    if (!containerRef) return;
    
    // Center on space center initially
    centerOn(spaceWidth / 2, spaceHeight / 2);
    
    setupPanning();
    setupZoom();
  });
  
  function centerOn(x: number, y: number) {
    if (!containerRef) return;
    const rect = containerRef.getBoundingClientRect();
    setOffsetX(rect.width / 2 - x * scale());
    setOffsetY(rect.height / 2 - y * scale());
    clampOffset();
  }
  
  function clampOffset() {
    if (!containerRef) return;
    const rect = containerRef.getBoundingClientRect();
    const scaledWidth = spaceWidth * scale();
    const scaledHeight = spaceHeight * scale();
    
    const maxOffsetX = 0;
    const minOffsetX = Math.min(0, rect.width - scaledWidth);
    const maxOffsetY = 0;
    const minOffsetY = Math.min(0, rect.height - scaledHeight);
    
    setOffsetX((x) => Math.max(minOffsetX, Math.min(maxOffsetX, x)));
    setOffsetY((y) => Math.max(minOffsetY, Math.min(maxOffsetY, y)));
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
      
      setOffsetX((x) => x + deltaX);
      setOffsetY((y) => y + deltaY);
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
      
      setOffsetX((x) => x + deltaX);
      setOffsetY((y) => y + deltaY);
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
      e.preventDefault();
      
      const delta = e.deltaY > 0 ? 0.9 : 1.1;
      const newScale = Math.min(Math.max(scale() * delta, 0.25), 2);
      
      const rect = containerRef!.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      
      setOffsetX(mouseX - (mouseX - offsetX()) * (newScale / scale()));
      setOffsetY(mouseY - (mouseY - offsetY()) * (newScale / scale()));
      setScale(newScale);
      clampOffset();
    };
    
    containerRef.addEventListener('wheel', handleWheel, { passive: false });
    
    onCleanup(() => {
      containerRef?.removeEventListener('wheel', handleWheel);
    });
  }
  
  return (
    <div id="canvas-container" ref={containerRef}>
      <div id="space" ref={spaceRef} style={{ transform: transform() }}>
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
      </div>
      
      {/* Space Info */}
      <div id="space-info">
        <span id="space-name">{ctx.session()?.spaceId}</span>
        <span id="participant-count">{ctx.peers().size} participant{ctx.peers().size !== 1 ? 's' : ''}</span>
      </div>
    </div>
  );
};

/**
 * ScreenShare Component
 * Displays a screen share in the space.
 */
import { Component, createMemo, Show, createSignal, onMount, onCleanup } from 'solid-js';
import { useSpace } from '@/context/SpaceContext';

interface ScreenShareProps {
  shareId: string;
}

export const ScreenShare: Component<ScreenShareProps> = (props) => {
  const ctx = useSpace();
  
  let containerRef: HTMLDivElement | undefined;
  
  const [isDragging, setIsDragging] = createSignal(false);
  
  const share = createMemo(() => ctx.screenShares().get(props.shareId));
  
  onMount(() => {
    if (containerRef) {
      setupDrag();
    }
  });
  
  function setupDrag() {
    if (!containerRef) return;
    
    let startDragX = 0;
    let startDragY = 0;
    let initialX = 0;
    let initialY = 0;
    
    const handleMouseDown = (e: MouseEvent) => {
      if ((e.target as HTMLElement).classList.contains('resize-handle')) return;
      
      e.stopPropagation();
      setIsDragging(true);
      startDragX = e.clientX;
      startDragY = e.clientY;
      initialX = share()?.x ?? 0;
      initialY = share()?.y ?? 0;
    };
    
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging()) return;
      e.preventDefault();
      
      const deltaX = e.clientX - startDragX;
      const deltaY = e.clientY - startDragY;
      
      ctx.updateScreenSharePosition(props.shareId, initialX + deltaX, initialY + deltaY);
    };
    
    const handleMouseUp = () => {
      setIsDragging(false);
    };
    
    containerRef.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    
    onCleanup(() => {
      containerRef?.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    });
  }
  
  return (
    <Show when={share()}>
      {(s) => (
        <div
          ref={containerRef}
          class="screen-share"
          classList={{ 'dragging': isDragging() }}
          style={{
            transform: `translate(${s().x}px, ${s().y}px)`,
            width: `${s().width}px`,
            height: `${s().height}px`,
          }}
          data-share-id={props.shareId}
        >
          <div class="screen-share-header">
            <span class="screen-share-title">{s().username}'s screen</span>
          </div>
          <div class="screen-share-video-container">
            <video class="screen-share-video" autoplay playsinline />
          </div>
          <div class="resize-handle resize-handle-se" />
        </div>
      )}
    </Show>
  );
};

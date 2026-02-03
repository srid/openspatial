/**
 * ScreenShare Component
 * Displays a screen share in the space.
 */
import { Component, createMemo, Show, createSignal, onMount, onCleanup } from 'solid-js';
import { useSpace } from '@/context/SpaceContext';
import { useCRDT } from '@/hooks/useCRDT';

interface ScreenShareProps {
  shareId: string;
}

export const ScreenShare: Component<ScreenShareProps> = (props) => {
  const { screenShares } = useSpace();
  const crdt = useCRDT();
  
  let containerRef: HTMLDivElement | undefined;
  
  const [isDragging, setIsDragging] = createSignal(false);
  const [isResizing, setIsResizing] = createSignal(false);
  
  const share = createMemo(() => screenShares().get(props.shareId));
  
  onMount(() => {
    if (containerRef) {
      setupDrag();
      setupResize();
    }
  });
  
  function setupDrag() {
    if (!containerRef) return;
    
    let startDragX = 0;
    let startDragY = 0;
    let initialX = 0;
    let initialY = 0;
    
    const handleMouseDown = (e: MouseEvent) => {
      // Don't start drag if clicking on resize handle
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
      
      crdt.updateScreenSharePosition(props.shareId, initialX + deltaX, initialY + deltaY);
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
  
  function setupResize() {
    // Resize logic will be implemented when needed
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
            {/* Video will be attached via WebRTC */}
            <video class="screen-share-video" autoplay playsinline />
          </div>
          <div class="resize-handle resize-handle-se" />
        </div>
      )}
    </Show>
  );
};

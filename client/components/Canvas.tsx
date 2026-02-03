/**
 * Canvas Component
 * The main scrollable/zoomable infinite canvas that holds all space elements.
 * This creates the #space element and handles pan/zoom.
 */
import { onMount, onCleanup, type JSX } from 'solid-js';
import { canvasTransform, panCanvas, zoomCanvas } from '../store/app';

export function Canvas(): JSX.Element {
  let containerRef: HTMLDivElement | undefined;
  let spaceRef: HTMLDivElement | undefined;
  
  let isDragging = false;
  let dragStartX = 0;
  let dragStartY = 0;

  const handleMouseDown = (e: MouseEvent) => {
    // Only start drag on the canvas itself, not child elements
    if (e.target === containerRef || e.target === spaceRef) {
      isDragging = true;
      dragStartX = e.clientX;
      dragStartY = e.clientY;
      if (containerRef) containerRef.style.cursor = 'grabbing';
    }
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!isDragging) return;
    const dx = e.clientX - dragStartX;
    const dy = e.clientY - dragStartY;
    panCanvas(dx, dy);
    dragStartX = e.clientX;
    dragStartY = e.clientY;
  };

  const handleMouseUp = () => {
    isDragging = false;
    if (containerRef) containerRef.style.cursor = 'grab';
  };

  const handleWheel = (e: WheelEvent) => {
    e.preventDefault();
    const delta = -e.deltaY * 0.001;
    zoomCanvas(delta, e.clientX, e.clientY);
  };

  onMount(() => {
    // Initial centering (center avatar starting position in view)
    const windowWidth = window.innerWidth;
    const windowHeight = window.innerHeight;
    panCanvas(windowWidth / 2 - 200, windowHeight / 2 - 200);

    // Global listeners for smooth dragging
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  });

  onCleanup(() => {
    window.removeEventListener('mousemove', handleMouseMove);
    window.removeEventListener('mouseup', handleMouseUp);
  });

  return (
    <>
      <div
        ref={containerRef}
        onMouseDown={handleMouseDown}
        onWheel={handleWheel}
        style={{
          position: 'fixed',
          inset: '0',
          overflow: 'hidden',
          cursor: 'grab',
        }}
      >
        <div
          id="space"
          ref={spaceRef}
          style={{
            position: 'absolute',
            width: '4000px',
            height: '4000px',
            left: '0',
            top: '0',
            'transform-origin': '0 0',
            transform: `translate(${canvasTransform.x}px, ${canvasTransform.y}px) scale(${canvasTransform.scale})`,
            background: `url('/client/assets/office-bg.svg') center/cover no-repeat, var(--color-bg-secondary)`,
          }}
        >
          {/* Avatars, screen shares, and text notes will be rendered here */}
        </div>
      </div>
    </>
  );
}

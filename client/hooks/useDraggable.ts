/**
 * useDraggable Hook
 * Provides consistent drag behavior for draggable elements via a header/handle.
 * Uses refs for drag state to avoid reactive updates during drag.
 */
import { createSignal, onCleanup, Accessor } from 'solid-js';

export interface DragConfig {
  /** Accessor returning current position */
  position: Accessor<{ x: number; y: number }>;
  /** Callback when element is dragged to a new position */
  onMove: (x: number, y: number) => void;
}

export interface DragResult {
  /** Signal indicating if currently dragging */
  isDragging: Accessor<boolean>;
  /** Setup function to call in onMount with header/handle ref */
  setup: (headerRef: HTMLElement) => void;
}

export function useDraggable(config: DragConfig): DragResult {
  const [isDragging, setIsDragging] = createSignal(false);

  let dragState = {
    isDragging: false,
    startX: 0,
    startY: 0,
    initialX: 0,
    initialY: 0,
  };

  function setup(headerRef: HTMLElement) {
    const handleMouseDown = (e: MouseEvent) => {
      // Don't drag if clicking on a button
      if ((e.target as HTMLElement).closest('button')) return;

      e.stopPropagation();
      e.preventDefault();

      const pos = config.position();
      dragState.isDragging = true;
      dragState.startX = e.clientX;
      dragState.startY = e.clientY;
      dragState.initialX = pos.x;
      dragState.initialY = pos.y;
      setIsDragging(true);
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (!dragState.isDragging) return;
      e.preventDefault();

      const deltaX = e.clientX - dragState.startX;
      const deltaY = e.clientY - dragState.startY;

      config.onMove(dragState.initialX + deltaX, dragState.initialY + deltaY);
    };

    const handleMouseUp = () => {
      if (dragState.isDragging) {
        dragState.isDragging = false;
        setIsDragging(false);
      }
    };

    headerRef.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    onCleanup(() => {
      headerRef.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    });
  }

  return { isDragging, setup };
}

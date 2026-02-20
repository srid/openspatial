/**
 * useDraggable Hook
 * Provides consistent drag behavior for draggable elements via a header/handle.
 * Supports both mouse and touch input with optional drag-end notification.
 * Uses refs for drag state to avoid reactive updates during drag.
 */
import { createSignal, onCleanup, Accessor } from 'solid-js';

export interface DragConfig {
  /** Accessor returning current position */
  position: Accessor<{ x: number; y: number }>;
  /** Callback when element is dragged to a new position */
  onMove: (x: number, y: number) => void;
  /** Optional callback when drag ends with the final position */
  onDragEnd?: (pos: { x: number; y: number }) => void;
  /** If true, allow dragging even when clicking on buttons (default: false) */
  skipButtonCheck?: boolean;
}

export interface DragResult {
  /** Signal indicating if currently dragging */
  isDragging: Accessor<boolean>;
  /** Setup function to call with the drag handle element */
  setup: (handleRef: HTMLElement) => void;
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

  function startDrag(clientX: number, clientY: number) {
    const pos = config.position();
    dragState.isDragging = true;
    dragState.startX = clientX;
    dragState.startY = clientY;
    dragState.initialX = pos.x;
    dragState.initialY = pos.y;
    setIsDragging(true);
  }

  function moveDrag(clientX: number, clientY: number) {
    if (!dragState.isDragging) return;
    const deltaX = clientX - dragState.startX;
    const deltaY = clientY - dragState.startY;
    config.onMove(dragState.initialX + deltaX, dragState.initialY + deltaY);
  }

  function endDrag() {
    if (!dragState.isDragging) return;
    dragState.isDragging = false;
    setIsDragging(false);
    if (config.onDragEnd) {
      const pos = config.position();
      config.onDragEnd({ x: pos.x, y: pos.y });
    }
  }

  function setup(handleRef: HTMLElement) {
    // --- Mouse events ---
    const handleMouseDown = (e: MouseEvent) => {
      if (!config.skipButtonCheck && (e.target as HTMLElement).closest('button')) return;
      e.stopPropagation();
      e.preventDefault();
      startDrag(e.clientX, e.clientY);
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (!dragState.isDragging) return;
      e.preventDefault();
      moveDrag(e.clientX, e.clientY);
    };

    const handleMouseUp = () => endDrag();

    handleRef.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    // --- Touch events ---
    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) return;
      if (!config.skipButtonCheck && (e.target as HTMLElement).closest('button')) return;
      e.stopPropagation();
      e.preventDefault();
      startDrag(e.touches[0].clientX, e.touches[0].clientY);
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!dragState.isDragging || e.touches.length !== 1) return;
      e.preventDefault();
      moveDrag(e.touches[0].clientX, e.touches[0].clientY);
    };

    const handleTouchEnd = () => endDrag();

    handleRef.addEventListener('touchstart', handleTouchStart, { passive: false });
    document.addEventListener('touchmove', handleTouchMove, { passive: false });
    document.addEventListener('touchend', handleTouchEnd);

    onCleanup(() => {
      handleRef.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      handleRef.removeEventListener('touchstart', handleTouchStart);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleTouchEnd);
    });
  }

  return { isDragging, setup };
}

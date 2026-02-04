/**
 * useResizable Hook
 * Provides consistent resize behavior for resizable elements.
 * Uses a custom resize handle with mouse events for precise control.
 */
import { createSignal, onCleanup, Accessor } from 'solid-js';
import { JSX } from 'solid-js/jsx-runtime';

export interface ResizeConfig {
  /** Current width */
  width: Accessor<number>;
  /** Current height */
  height: Accessor<number>;
  /** Callback when size changes */
  onResize: (width: number, height: number) => void;
  /** Minimum width (default: 100) */
  minWidth?: number;
  /** Minimum height (default: 100) */
  minHeight?: number;
}

export interface ResizeResult {
  /** Signal indicating if currently resizing */
  isResizing: Accessor<boolean>;
  /** Props to spread on the container element */
  containerProps: {
    'data-resizable': boolean;
  };
  /** Resize handle element to render inside the container */
  ResizeHandle: () => JSX.Element;
  /** Setup function to call in onMount with container ref */
  setup: (containerRef: HTMLElement) => void;
}

export function useResizable(config: ResizeConfig): ResizeResult {
  const minWidth = config.minWidth ?? 100;
  const minHeight = config.minHeight ?? 100;
  
  const [isResizing, setIsResizing] = createSignal(false);
  
  let resizeState = {
    isResizing: false,
    startX: 0,
    startY: 0,
    initialWidth: 0,
    initialHeight: 0,
  };
  
  function setup(containerRef: HTMLElement) {
    const resizeHandle = containerRef.querySelector('.resize-handle-se') as HTMLElement;
    if (!resizeHandle) return;
    
    const handleMouseDown = (e: MouseEvent) => {
      e.stopPropagation();
      e.preventDefault();
      
      resizeState.isResizing = true;
      resizeState.startX = e.clientX;
      resizeState.startY = e.clientY;
      resizeState.initialWidth = config.width();
      resizeState.initialHeight = config.height();
      setIsResizing(true);
    };
    
    const handleMouseMove = (e: MouseEvent) => {
      if (!resizeState.isResizing) return;
      e.preventDefault();
      
      const deltaX = e.clientX - resizeState.startX;
      const deltaY = e.clientY - resizeState.startY;
      
      const newWidth = Math.max(minWidth, resizeState.initialWidth + deltaX);
      const newHeight = Math.max(minHeight, resizeState.initialHeight + deltaY);
      
      config.onResize(Math.round(newWidth), Math.round(newHeight));
    };
    
    const handleMouseUp = () => {
      if (resizeState.isResizing) {
        resizeState.isResizing = false;
        setIsResizing(false);
      }
    };
    
    // Touch support for mobile
    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) return;
      e.stopPropagation();
      
      const touch = e.touches[0];
      resizeState.isResizing = true;
      resizeState.startX = touch.clientX;
      resizeState.startY = touch.clientY;
      resizeState.initialWidth = config.width();
      resizeState.initialHeight = config.height();
      setIsResizing(true);
    };
    
    const handleTouchMove = (e: TouchEvent) => {
      if (!resizeState.isResizing || e.touches.length !== 1) return;
      
      const touch = e.touches[0];
      const deltaX = touch.clientX - resizeState.startX;
      const deltaY = touch.clientY - resizeState.startY;
      
      const newWidth = Math.max(minWidth, resizeState.initialWidth + deltaX);
      const newHeight = Math.max(minHeight, resizeState.initialHeight + deltaY);
      
      config.onResize(Math.round(newWidth), Math.round(newHeight));
    };
    
    const handleTouchEnd = () => {
      if (resizeState.isResizing) {
        resizeState.isResizing = false;
        setIsResizing(false);
      }
    };
    
    resizeHandle.addEventListener('mousedown', handleMouseDown);
    resizeHandle.addEventListener('touchstart', handleTouchStart, { passive: true });
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    document.addEventListener('touchmove', handleTouchMove, { passive: true });
    document.addEventListener('touchend', handleTouchEnd);
    
    onCleanup(() => {
      resizeHandle?.removeEventListener('mousedown', handleMouseDown);
      resizeHandle?.removeEventListener('touchstart', handleTouchStart);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleTouchEnd);
    });
  }
  
  const ResizeHandle = () => (
    <div class="resize-handle resize-handle-se" />
  );
  
  return {
    isResizing,
    containerProps: {
      'data-resizable': true,
    },
    ResizeHandle,
    setup,
  };
}

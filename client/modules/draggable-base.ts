/**
 * Draggable Element Manager Base Class
 * Provides shared drag functionality for canvas elements (avatars, screen shares, text notes).
 */

/**
 * Callback type for position updates.
 */
export type PositionUpdateCallback = (id: string, x: number, y: number) => void;

/**
 * Abstract base class providing common drag behavior for canvas elements.
 * Subclasses should call setupDrag() to enable dragging on an element.
 */
export abstract class DraggableElementManager<T extends HTMLElement = HTMLDivElement> {
  protected elements = new Map<string, T>();
  protected onPositionUpdate: PositionUpdateCallback | null = null;

  /**
   * Set the callback for position updates.
   */
  setPositionUpdateCallback(callback: PositionUpdateCallback): void {
    this.onPositionUpdate = callback;
  }

  /**
   * Check if an element exists with the given ID.
   */
  hasElement(id: string): boolean {
    return this.elements.has(id);
  }

  /**
   * Get all element IDs.
   */
  getAllIds(): string[] {
    return Array.from(this.elements.keys());
  }

  /**
   * Set up drag behavior on an element.
   * @param element The draggable element
   * @param id Unique identifier for the element
   * @param handle Optional drag handle element (defaults to element itself)
   * @param onDragEnd Optional callback when drag ends
   */
  protected setupDrag(
    element: T,
    id: string,
    handle?: HTMLElement,
    onDragEnd?: (x: number, y: number) => void
  ): void {
    const dragHandle = handle || element;
    let isDragging = false;
    let startX = 0;
    let startY = 0;
    let initialLeft = 0;
    let initialTop = 0;

    dragHandle.style.cursor = 'grab';

    const onMouseDown = (e: MouseEvent) => {
      // Don't start drag if clicking on interactive elements
      const target = e.target as HTMLElement;
      if (target.closest('button, input, textarea, select, [contenteditable]')) {
        return;
      }

      e.stopPropagation();
      isDragging = true;
      startX = e.clientX;
      startY = e.clientY;
      initialLeft = parseFloat(element.style.left) || 0;
      initialTop = parseFloat(element.style.top) || 0;
      dragHandle.style.cursor = 'grabbing';
      element.style.zIndex = '20';
    };

    const onMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;

      const deltaX = e.clientX - startX;
      const deltaY = e.clientY - startY;
      const newX = Math.max(0, initialLeft + deltaX);
      const newY = Math.max(0, initialTop + deltaY);

      element.style.left = `${newX}px`;
      element.style.top = `${newY}px`;
    };

    const onMouseUp = () => {
      if (isDragging) {
        isDragging = false;
        dragHandle.style.cursor = 'grab';
        element.style.zIndex = '10';

        const x = parseFloat(element.style.left) || 0;
        const y = parseFloat(element.style.top) || 0;

        if (onDragEnd) {
          onDragEnd(x, y);
        }

        if (this.onPositionUpdate) {
          this.onPositionUpdate(id, x, y);
        }
      }
    };

    dragHandle.addEventListener('mousedown', onMouseDown);
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }

  /**
   * Set element position.
   */
  setPosition(id: string, x: number, y: number): void {
    const element = this.elements.get(id);
    if (element) {
      element.style.left = `${x}px`;
      element.style.top = `${y}px`;
    }
  }

  /**
   * Remove an element by ID.
   */
  protected removeElement(id: string): void {
    const element = this.elements.get(id);
    if (element) {
      element.remove();
      this.elements.delete(id);
    }
  }

  /**
   * Clear all elements.
   */
  clear(): void {
    this.elements.forEach((element) => element.remove());
    this.elements.clear();
  }
}

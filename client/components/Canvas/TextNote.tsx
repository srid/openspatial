/**
 * TextNote Component
 * Collaborative text note in the space with header.
 * Uses local state for editing and only syncs to CRDT on blur.
 */
import { Component, createMemo, Show, createSignal, onMount, onCleanup, createEffect } from 'solid-js';
import { useSpace } from '@/context/SpaceContext';

interface TextNoteProps {
  noteId: string;
}

export const TextNote: Component<TextNoteProps> = (props) => {
  const ctx = useSpace();
  
  let containerRef: HTMLDivElement | undefined;
  let headerRef: HTMLDivElement | undefined;
  let textareaRef: HTMLTextAreaElement | undefined;
  
  // Use plain object refs for drag state to avoid reactivity issues
  const dragState = {
    isDragging: false,
    startX: 0,
    startY: 0,
    initialX: 0,
    initialY: 0,
  };
  
  const [isDraggingSignal, setIsDraggingSignal] = createSignal(false);
  const [isEditing, setIsEditing] = createSignal(false);
  const [localContent, setLocalContent] = createSignal('');
  
  const note = createMemo(() => ctx.textNotes().get(props.noteId));
  
  // Initialize local content from CRDT once
  createEffect(() => {
    const n = note();
    if (n && !isEditing()) {
      setLocalContent(n.content);
    }
  });
  
  onMount(() => {
    if (containerRef && headerRef) {
      setupDrag();
    }
  });
  
  function setupDrag() {
    if (!headerRef) return;
    
    const handleMouseDown = (e: MouseEvent) => {
      e.stopPropagation();
      e.preventDefault();
      
      const n = note();
      if (!n) return;
      
      dragState.isDragging = true;
      dragState.startX = e.clientX;
      dragState.startY = e.clientY;
      dragState.initialX = n.x;
      dragState.initialY = n.y;
      setIsDraggingSignal(true);
    };
    
    const handleMouseMove = (e: MouseEvent) => {
      if (!dragState.isDragging) return;
      e.preventDefault();
      
      const deltaX = e.clientX - dragState.startX;
      const deltaY = e.clientY - dragState.startY;
      
      ctx.updateTextNotePosition(props.noteId, dragState.initialX + deltaX, dragState.initialY + deltaY);
    };
    
    const handleMouseUp = () => {
      if (dragState.isDragging) {
        dragState.isDragging = false;
        setIsDraggingSignal(false);
      }
    };
    
    headerRef.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    
    onCleanup(() => {
      headerRef?.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    });
  }
  
  function handleContentChange(e: Event) {
    const target = e.target as HTMLTextAreaElement;
    setLocalContent(target.value);
    // Do NOT update CRDT here - wait for blur
  }
  
  function handleFocus() {
    setIsEditing(true);
  }
  
  function handleBlur() {
    setIsEditing(false);
    // Sync to CRDT only on blur
    ctx.updateTextNoteContent(props.noteId, localContent());
  }
  
  function handleClose() {
    ctx.removeTextNote(props.noteId);
  }
  
  return (
    <Show when={note()}>
      {(n) => (
        <div
          ref={containerRef}
          class="text-note"
          classList={{
            'dragging': isDraggingSignal(),
            'editing': isEditing(),
          }}
          style={{
            transform: `translate(${n().x}px, ${n().y}px)`,
            width: `${n().width}px`,
            height: `${n().height}px`,
          }}
          data-note-id={props.noteId}
        >
          <div ref={headerRef} class="text-note-header">
            <span class="text-note-title">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14,2 14,8 20,8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
              </svg>
              Note
            </span>
            <div class="text-note-controls">
              <button class="text-note-close" onClick={handleClose} title="Delete note">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
          </div>
          <div class="text-note-content">
            <textarea
              ref={textareaRef}
              class="text-note-textarea"
              value={localContent()}
              onInput={handleContentChange}
              onFocus={handleFocus}
              onBlur={handleBlur}
              placeholder="Type your note..."
            />
          </div>
          <div class="resize-handle resize-handle-se" />
        </div>
      )}
    </Show>
  );
};

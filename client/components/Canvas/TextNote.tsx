/**
 * TextNote Component
 * Collaborative text note in the space.
 */
import { Component, createMemo, Show, createSignal, onMount, onCleanup } from 'solid-js';
import { useSpace } from '@/context/SpaceContext';
import { useCRDT } from '@/hooks/useCRDT';

interface TextNoteProps {
  noteId: string;
}

export const TextNote: Component<TextNoteProps> = (props) => {
  const { textNotes } = useSpace();
  const crdt = useCRDT();
  
  let containerRef: HTMLDivElement | undefined;
  let textareaRef: HTMLTextAreaElement | undefined;
  
  const [isDragging, setIsDragging] = createSignal(false);
  const [isEditing, setIsEditing] = createSignal(false);
  
  const note = createMemo(() => textNotes().get(props.noteId));
  
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
      // Don't drag if clicking on textarea
      if (e.target === textareaRef) return;
      if ((e.target as HTMLElement).classList.contains('resize-handle')) return;
      
      e.stopPropagation();
      setIsDragging(true);
      startDragX = e.clientX;
      startDragY = e.clientY;
      initialX = note()?.x ?? 0;
      initialY = note()?.y ?? 0;
    };
    
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging()) return;
      e.preventDefault();
      
      const deltaX = e.clientX - startDragX;
      const deltaY = e.clientY - startDragY;
      
      crdt.updateTextNotePosition(props.noteId, initialX + deltaX, initialY + deltaY);
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
  
  function handleContentChange(e: Event) {
    const target = e.target as HTMLTextAreaElement;
    crdt.updateTextNoteContent(props.noteId, target.value);
  }
  
  const fontSizeClass = createMemo(() => {
    const n = note();
    if (!n) return '';
    return `font-size-${n.fontSize}`;
  });
  
  const fontFamilyClass = createMemo(() => {
    const n = note();
    if (!n) return '';
    return `font-family-${n.fontFamily}`;
  });
  
  return (
    <Show when={note()}>
      {(n) => (
        <div
          ref={containerRef}
          class="text-note"
          classList={{
            'dragging': isDragging(),
            'editing': isEditing(),
            [fontSizeClass()]: true,
            [fontFamilyClass()]: true,
          }}
          style={{
            transform: `translate(${n().x}px, ${n().y}px)`,
            width: `${n().width}px`,
            height: `${n().height}px`,
            '--note-color': n().color,
          }}
          data-note-id={props.noteId}
        >
          <textarea
            ref={textareaRef}
            class="text-note-content"
            value={n().content}
            onInput={handleContentChange}
            onFocus={() => setIsEditing(true)}
            onBlur={() => setIsEditing(false)}
            placeholder="Type your note..."
          />
          <div class="resize-handle resize-handle-se" />
        </div>
      )}
    </Show>
  );
};

/**
 * TextNote Component
 * Collaborative text note in the space with header.
 * Uses local state for editing and only syncs to CRDT on blur.
 */
import { Component, createMemo, Show, createSignal, onMount, onCleanup, createEffect, For } from 'solid-js';
import { useSpace } from '@/context/SpaceContext';

interface TextNoteProps {
  noteId: string;
}

const FONT_SIZES = {
  small: '14px',
  medium: '18px',
  large: '24px',
} as const;

const FONT_FAMILIES = {
  sans: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
  serif: "Georgia, 'Times New Roman', serif",
  mono: "'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace",
} as const;

const COLOR_PALETTE = [
  { name: 'White', value: '#ffffff' },
  { name: 'Yellow', value: '#fef08a' },
  { name: 'Cyan', value: '#67e8f9' },
  { name: 'Pink', value: '#f9a8d4' },
  { name: 'Green', value: '#86efac' },
];

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
  const [showFontSizeMenu, setShowFontSizeMenu] = createSignal(false);
  const [showFontFamilyMenu, setShowFontFamilyMenu] = createSignal(false);
  const [showColorMenu, setShowColorMenu] = createSignal(false);
  
  const note = createMemo(() => ctx.textNotes().get(props.noteId));
  
  // Local content is what the user is actively typing
  // Display content shows CRDT when not editing, local when editing
  createEffect(() => {
    const n = note();
    const crdtContent = n?.content ?? '';
    // Initialize local content from CRDT when first loaded
    if (localContent() === '' && crdtContent !== '') {
      setLocalContent(crdtContent);
    }
  });
  
  // What actually shows in the textarea - CRDT when not editing, localContent when editing
  const displayContent = createMemo(() => {
    if (isEditing()) {
      return localContent();
    }
    // When not editing, show CRDT content directly
    return note()?.content ?? '';
  });
  
  onMount(() => {
    if (containerRef && headerRef) {
      setupDrag();
      setupResize();
      
      // Listen for test-resize events from e2e tests
      containerRef.addEventListener('test-resize', ((e: CustomEvent) => {
        const { width, height } = e.detail;
        ctx.updateTextNoteSize(props.noteId, width, height);
      }) as EventListener);
    }
  });
  
  function setupDrag() {
    if (!headerRef) return;
    
    const handleMouseDown = (e: MouseEvent) => {
      // Don't drag if clicking on a button
      if ((e.target as HTMLElement).closest('.text-note-btn, .text-note-close')) return;
      
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
  
  function setupResize() {
    if (!containerRef) return;
    
    // Use ResizeObserver to track size changes
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        let width: number, height: number;
        if (entry.borderBoxSize && entry.borderBoxSize.length > 0) {
          width = entry.borderBoxSize[0].inlineSize;
          height = entry.borderBoxSize[0].blockSize;
        } else {
          const rect = containerRef!.getBoundingClientRect();
          width = rect.width;
          height = rect.height;
        }
        ctx.updateTextNoteSize(props.noteId, Math.round(width), Math.round(height));
      }
    });
    
    resizeObserver.observe(containerRef);
    
    onCleanup(() => {
      resizeObserver.disconnect();
    });
  }
  
  function handleContentChange(e: Event) {
    const target = e.target as HTMLTextAreaElement;
    setLocalContent(target.value);
    // Sync to CRDT immediately for real-time collaboration
    ctx.updateTextNoteContent(props.noteId, target.value);
  }
  
  function handleFocus() {
    setIsEditing(true);
  }
  
  function handleBlur() {
    setIsEditing(false);
    // Ensure final content is synced when leaving field
    ctx.updateTextNoteContent(props.noteId, localContent());
  }
  
  function handleClose() {
    ctx.removeTextNote(props.noteId);
  }
  
  function handleFontSizeClick(e: MouseEvent) {
    e.stopPropagation();
    setShowFontSizeMenu(!showFontSizeMenu());
    setShowFontFamilyMenu(false);
    setShowColorMenu(false);
  }
  
  function handleFontFamilyClick(e: MouseEvent) {
    e.stopPropagation();
    setShowFontFamilyMenu(!showFontFamilyMenu());
    setShowFontSizeMenu(false);
    setShowColorMenu(false);
  }
  
  function handleColorClick(e: MouseEvent) {
    e.stopPropagation();
    setShowColorMenu(!showColorMenu());
    setShowFontSizeMenu(false);
    setShowFontFamilyMenu(false);
  }
  
  function selectFontSize(size: 'small' | 'medium' | 'large') {
    setShowFontSizeMenu(false);
    const n = note();
    if (n) {
      ctx.updateTextNoteStyle(props.noteId, size, n.fontFamily || 'sans', n.color || '#ffffff');
    }
  }
  
  function selectFontFamily(family: 'sans' | 'serif' | 'mono') {
    setShowFontFamilyMenu(false);
    const n = note();
    if (n) {
      ctx.updateTextNoteStyle(props.noteId, n.fontSize || 'medium', family, n.color || '#ffffff');
    }
  }
  
  function selectColor(color: string) {
    setShowColorMenu(false);
    const n = note();
    if (n) {
      ctx.updateTextNoteStyle(props.noteId, n.fontSize || 'medium', n.fontFamily || 'sans', color);
    }
  }
  
  // Close menus when clicking outside
  createEffect(() => {
    if (showFontSizeMenu() || showFontFamilyMenu() || showColorMenu()) {
      const closeMenus = (e: MouseEvent) => {
        if (!containerRef?.contains(e.target as Node)) {
          setShowFontSizeMenu(false);
          setShowFontFamilyMenu(false);
          setShowColorMenu(false);
        }
      };
      setTimeout(() => document.addEventListener('click', closeMenus), 0);
      onCleanup(() => document.removeEventListener('click', closeMenus));
    }
  });
  
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
            position: 'absolute',
            left: `${n().x}px`,
            top: `${n().y}px`,
            width: `${n().width}px`,
            height: `${n().height}px`,
          }}
          data-note-id={props.noteId}
        >
          <div ref={headerRef} class="text-note-header">
            <span class="text-note-title">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M12 20h9"></path>
                <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>
              </svg>
              Note
            </span>
            <div class="text-note-controls">
              {/* Font Size Button */}
              <div style={{ position: 'relative' }}>
                <button class="text-note-btn text-note-font-size" onClick={handleFontSizeClick} title="Font size">
                  A
                </button>
                <Show when={showFontSizeMenu()}>
                  <div class="text-note-menu">
                    <For each={(['small', 'medium', 'large'] as const)}>
                      {(size) => (
                        <button
                          class="text-note-menu-option"
                          style={{ 'font-size': FONT_SIZES[size] }}
                          onClick={(e) => { e.stopPropagation(); selectFontSize(size); }}
                        >
                          {size.charAt(0).toUpperCase() + size.slice(1)}
                        </button>
                      )}
                    </For>
                  </div>
                </Show>
              </div>
              
              {/* Font Family Button */}
              <div style={{ position: 'relative' }}>
                <button class="text-note-btn text-note-font-family" onClick={handleFontFamilyClick} title="Font family">
                  Aa
                </button>
                <Show when={showFontFamilyMenu()}>
                  <div class="text-note-menu">
                    <For each={[
                      { name: 'Sans', value: 'sans' as const },
                      { name: 'Serif', value: 'serif' as const },
                      { name: 'Mono', value: 'mono' as const },
                    ]}>
                      {(family) => (
                        <button
                          class="text-note-menu-option"
                          style={{ 'font-family': FONT_FAMILIES[family.value] }}
                          onClick={(e) => { e.stopPropagation(); selectFontFamily(family.value); }}
                        >
                          {family.name}
                        </button>
                      )}
                    </For>
                  </div>
                </Show>
              </div>
              
              {/* Color Button */}
              <div style={{ position: 'relative' }}>
                <button
                  class="text-note-btn text-note-color"
                  onClick={handleColorClick}
                  title="Text color"
                  style={{ 'background-color': n().color || '#ffffff' }}
                />
                <Show when={showColorMenu()}>
                  <div class="text-note-menu text-note-color-menu">
                    <For each={COLOR_PALETTE}>
                      {(color) => (
                        <button
                          class="text-note-color-option"
                          style={{ 'background-color': color.value }}
                          title={color.name}
                          onClick={(e) => { e.stopPropagation(); selectColor(color.value); }}
                        />
                      )}
                    </For>
                  </div>
                </Show>
              </div>
              
              {/* Close Button */}
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
              value={displayContent()}
              onInput={handleContentChange}
              onFocus={handleFocus}
              onBlur={handleBlur}
              placeholder="Type your note..."
              style={{
                'font-size': FONT_SIZES[n().fontSize || 'medium'],
                'font-family': FONT_FAMILIES[n().fontFamily || 'sans'],
                color: n().color || '#ffffff',
              }}
            />
          </div>
        </div>
      )}
    </Show>
  );
};

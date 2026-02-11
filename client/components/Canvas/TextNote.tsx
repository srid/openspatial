/**
 * TextNote Component
 * Collaborative text note in the space with header.
 * Uses local state for editing and only syncs to CRDT on blur.
 */
import { Component, createMemo, Show, createSignal, onMount, onCleanup, createEffect, For } from 'solid-js';
import { useSpace } from '@/context/SpaceContext';
import { useResizable } from '@/hooks/useResizable';

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
  // Local content is what the user is actively typing
  const [localContent, setLocalContent] = createSignal('');
  const [showFontSizeMenu, setShowFontSizeMenu] = createSignal(false);
  const [showFontFamilyMenu, setShowFontFamilyMenu] = createSignal(false);
  const [showColorMenu, setShowColorMenu] = createSignal(false);
  
  // Resizable hook for consistent resize behavior
  const resizable = useResizable({
    width: () => note()?.width ?? 300,
    height: () => note()?.height ?? 200,
    onResize: (width, height) => ctx.updateTextNoteSize(props.noteId, width, height),
    minWidth: 200,
    minHeight: 150,
  });
  
  const note = createMemo(() => ctx.textNotes().get(props.noteId));
  
  // Display content shows CRDT when not editing, local when editing
  // Initialize local content from CRDT when first loaded
  createEffect(() => {
    const n = note();
    const crdtContent = n?.content ?? '';
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
      resizable.setup(containerRef);
      
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
      if ((e.target as HTMLElement).closest('button')) return;
      
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
  
  // Resize is handled by useResizable hook
  
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
          class="text-note absolute min-w-[200px] min-h-[120px] bg-bg-secondary border border-border rounded-xl overflow-visible shadow-xl z-5"
          style={{
            position: 'absolute',
            left: `${n().x}px`,
            top: `${n().y}px`,
            width: `${n().width}px`,
            height: `${n().height}px`,
          }}
          data-note-id={props.noteId}
        >
          <div ref={headerRef} class="text-note-header relative z-10 flex items-center justify-between py-2 px-3 bg-bg-tertiary border-b border-border rounded-t-xl cursor-grab active:cursor-grabbing">
            <span class="flex items-center gap-2 text-sm font-medium">
              <svg class="w-3.5 h-3.5 text-text-muted" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M12 20h9"></path>
                <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>
              </svg>
              Note
            </span>
            <div class="flex items-center gap-1">
              {/* Font Size Button */}
              <div class="relative">
                <button class="text-note-font-size relative flex items-center justify-center w-6 h-6 bg-surface border border-border rounded-sm text-text-secondary cursor-pointer text-xs font-semibold transition-all duration-(--transition-fast) hover:bg-surface-hover hover:text-text-primary font-serif" onClick={handleFontSizeClick} title="Font size">
                  A
                </button>
                <Show when={showFontSizeMenu()}>
                  <div class="absolute top-full right-0 mt-1 bg-bg-elevated border border-border rounded-md p-1 z-[1000] shadow-lg">
                    <For each={(['small', 'medium', 'large'] as const)}>
                      {(size) => (
                        <button
                          class="text-note-menu-option block w-full py-2 px-3 bg-transparent border-none rounded-sm text-text-primary cursor-pointer text-left transition-all duration-(--transition-fast) hover:bg-surface-hover"
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
              <div class="relative">
                <button class="text-note-font-family relative flex items-center justify-center w-6 h-6 bg-surface border border-border rounded-sm text-text-secondary cursor-pointer text-xs font-semibold transition-all duration-(--transition-fast) hover:bg-surface-hover hover:text-text-primary" onClick={handleFontFamilyClick} title="Font family">
                  Aa
                </button>
                <Show when={showFontFamilyMenu()}>
                  <div class="absolute top-full right-0 mt-1 bg-bg-elevated border border-border rounded-md p-1 z-[1000] shadow-lg">
                    <For each={[
                      { name: 'Sans', value: 'sans' as const },
                      { name: 'Serif', value: 'serif' as const },
                      { name: 'Mono', value: 'mono' as const },
                    ]}>
                      {(family) => (
                        <button
                          class="text-note-menu-option block w-full py-2 px-3 bg-transparent border-none rounded-sm text-text-primary cursor-pointer text-left transition-all duration-(--transition-fast) hover:bg-surface-hover"
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
              <div class="relative">
                <button
                  class="text-note-color relative flex items-center justify-center w-6 h-6 border-2 border-border rounded-sm cursor-pointer transition-all duration-(--transition-fast) hover:scale-110"
                  onClick={handleColorClick}
                  title="Text color"
                  style={{ 'background-color': n().color || '#ffffff' }}
                />
                <Show when={showColorMenu()}>
                  <div class="absolute top-full right-0 mt-1 bg-bg-elevated border border-border rounded-md p-2 z-[1000] shadow-lg flex gap-1">
                    <For each={COLOR_PALETTE}>
                      {(color) => (
                        <button
                          class="text-note-color-option w-6 h-6 border-2 border-border rounded-sm cursor-pointer transition-all duration-(--transition-fast) hover:scale-110 hover:shadow-[0_0_8px_rgba(255,255,255,0.3)]"
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
              <button class="text-note-close flex items-center justify-center w-6 h-6 bg-transparent border-none rounded-sm text-text-muted cursor-pointer transition-all duration-(--transition-fast) hover:bg-danger/20 hover:text-danger" onClick={handleClose} title="Delete note">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
          </div>
          <div class="h-[calc(100%-40px)] p-2">
            <textarea
              ref={textareaRef}
              class="text-note-textarea w-full h-full bg-transparent border-none text-white font-[inherit] text-lg leading-relaxed resize-none outline-none placeholder:text-text-muted"
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
          <resizable.ResizeHandle />
        </div>
      )}
    </Show>
  );
};

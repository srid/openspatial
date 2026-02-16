/**
 * TextNote Component
 * Collaborative text note in the space with header.
 * Uses CodeMirror 6 + y-codemirror.next for real-time collaborative editing.
 */
import { Component, createMemo, Show, createSignal, onMount, onCleanup, createEffect, For } from 'solid-js';
import { useSpace } from '@/context/SpaceContext';
import { useDraggable } from '@/hooks/useDraggable';
import { useResizable } from '@/hooks/useResizable';
import { CollabEditor } from './CollabEditor';
import { CloseButton } from './CloseButton';

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

export const TextNote: Component<TextNoteProps> = (props) => {
  const ctx = useSpace();
  
  let containerRef: HTMLDivElement | undefined;
  let headerRef: HTMLDivElement | undefined;
  
  const [showFontSizeMenu, setShowFontSizeMenu] = createSignal(false);
  const [showFontFamilyMenu, setShowFontFamilyMenu] = createSignal(false);

  const note = createMemo(() => ctx.textNotes().get(props.noteId));
  
  const draggable = useDraggable({
    position: () => ({ x: note()?.x ?? 0, y: note()?.y ?? 0 }),
    onMove: (x, y) => ctx.updateTextNotePosition(props.noteId, x, y),
  });
  
  // Resizable hook for consistent resize behavior
  const resizable = useResizable({
    width: () => note()?.width ?? 300,
    height: () => note()?.height ?? 200,
    onResize: (width, height) => ctx.updateTextNoteSize(props.noteId, width, height),
    minWidth: 200,
    minHeight: 150,
  });
  
  onMount(() => {
    if (containerRef && headerRef) {
      draggable.setup(headerRef);
      resizable.setup(containerRef);
    }
  });
  

  
  function handleFontSizeClick(e: MouseEvent) {
    e.stopPropagation();
    setShowFontSizeMenu(!showFontSizeMenu());
    setShowFontFamilyMenu(false);
  }
  
  function handleFontFamilyClick(e: MouseEvent) {
    e.stopPropagation();
    setShowFontFamilyMenu(!showFontFamilyMenu());
    setShowFontSizeMenu(false);
  }
  
  function selectFontSize(size: 'small' | 'medium' | 'large') {
    setShowFontSizeMenu(false);
    const n = note();
    if (n) {
      ctx.updateTextNoteStyle(props.noteId, size, n.fontFamily || 'sans', '#ffffff');
    }
  }
  
  function selectFontFamily(family: 'sans' | 'serif' | 'mono') {
    setShowFontFamilyMenu(false);
    const n = note();
    if (n) {
      ctx.updateTextNoteStyle(props.noteId, n.fontSize || 'medium', family, '#ffffff');
    }
  }
  

  
  // Close menus when clicking outside
  createEffect(() => {
    if (showFontSizeMenu() || showFontFamilyMenu()) {
      const closeMenus = (e: MouseEvent) => {
        if (!containerRef?.contains(e.target as Node)) {
          setShowFontSizeMenu(false);
          setShowFontFamilyMenu(false);
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
              
              <CloseButton
                closeClass="text-note-close"
                confirmClass="text-note-confirm-delete"
                cancelClass="text-note-cancel-delete"
                title="Delete note"
                onConfirm={() => ctx.removeTextNote(props.noteId)}
              />
            </div>
          </div>
          <div class="h-[calc(100%-40px)] p-2">
            <CollabEditor
              noteId={props.noteId}
              fontSize={FONT_SIZES[n().fontSize || 'medium']}
              fontFamily={FONT_FAMILIES[n().fontFamily || 'sans']}
            />
          </div>
          <resizable.ResizeHandle />
        </div>
      )}
    </Show>
  );
};

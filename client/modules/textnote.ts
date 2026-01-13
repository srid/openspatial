/**
 * Text Note Manager - Handles text note elements on the canvas.
 * Similar to ScreenShareManager but for editable text content.
 */

type PositionUpdateCallback = (noteId: string, x: number, y: number) => void;
type SizeUpdateCallback = (noteId: string, width: number, height: number) => void;
type ContentUpdateCallback = (noteId: string, content: string) => void;
type StyleUpdateCallback = (noteId: string, fontSize: 'small' | 'medium' | 'large', color: string) => void;
type CloseCallback = (noteId: string) => void;

interface AppState {
  peerId: string | null;
}

const FONT_SIZES = {
  small: '14px',
  medium: '18px',
  large: '24px',
};

const FONT_FAMILIES = {
  sans: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
  serif: "Georgia, 'Times New Roman', serif",
  mono: "'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace",
};

const COLOR_PALETTE = [
  { name: 'White', value: '#ffffff' },
  { name: 'Yellow', value: '#fef08a' },
  { name: 'Cyan', value: '#67e8f9' },
  { name: 'Pink', value: '#f9a8d4' },
  { name: 'Green', value: '#86efac' },
];

export class TextNoteManager {
  private state: AppState;
  private textNotes = new Map<string, HTMLDivElement>();
  private space: HTMLElement | null = null;
  private onPositionUpdate: PositionUpdateCallback | null;
  private onSizeUpdate: SizeUpdateCallback | null;
  private onContentUpdate: ContentUpdateCallback | null;
  private onStyleUpdate: StyleUpdateCallback | null;
  private onClose: CloseCallback | null;
  private pendingState = new Map<string, { x?: number; y?: number; width?: number; height?: number; content?: string; fontSize?: 'small' | 'medium' | 'large'; fontFamily?: 'sans' | 'serif' | 'mono'; color?: string }>();

  constructor(
    state: AppState,
    onPositionUpdate: PositionUpdateCallback | null,
    onSizeUpdate: SizeUpdateCallback | null,
    onContentUpdate: ContentUpdateCallback | null,
    onStyleUpdate: StyleUpdateCallback | null,
    onClose: CloseCallback | null
  ) {
    this.state = state;
    this.onPositionUpdate = onPositionUpdate;
    this.onSizeUpdate = onSizeUpdate;
    this.onContentUpdate = onContentUpdate;
    this.onStyleUpdate = onStyleUpdate;
    this.onClose = onClose;
    this.space = document.getElementById('space');
  }

  createTextNote(
    noteId: string,
    peerId: string,
    username: string,
    content: string,
    x: number,
    y: number,
    width: number = 250,
    height: number = 150,
    fontSize: 'small' | 'medium' | 'large' = 'medium',
    fontFamily: 'sans' | 'serif' | 'mono' = 'sans',
    color: string = '#ffffff'
  ): void {
    if (this.textNotes.has(noteId)) return;

    const isLocal = peerId === this.state.peerId;
    const element = document.createElement('div');
    element.className = 'text-note';
    element.dataset.noteId = noteId;
    element.dataset.peerId = peerId;
    element.style.left = `${x}px`;
    element.style.top = `${y}px`;
    element.style.width = `${width}px`;
    element.style.height = `${height}px`;

    // Header
    const header = document.createElement('div');
    header.className = 'text-note-header';
    
    const title = document.createElement('div');
    title.className = 'text-note-title';
    title.innerHTML = `
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M12 20h9"></path>
        <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>
      </svg>
      <span>${isLocal ? 'Your Note' : `${username}'s Note`}</span>
    `;
    header.appendChild(title);

    // Controls (only for owner)
    if (isLocal) {
      const controls = document.createElement('div');
      controls.className = 'text-note-controls';

      // Font size selector
      const fontSizeBtn = document.createElement('button');
      fontSizeBtn.className = 'text-note-btn text-note-font-size';
      fontSizeBtn.title = 'Font size';
      fontSizeBtn.innerHTML = 'A';
      fontSizeBtn.onclick = (e) => {
        e.stopPropagation();
        this.showFontSizeMenu(element, noteId, fontSizeBtn);
      };
      controls.appendChild(fontSizeBtn);

      // Font family selector
      const fontFamilyBtn = document.createElement('button');
      fontFamilyBtn.className = 'text-note-btn text-note-font-family';
      fontFamilyBtn.title = 'Font family';
      fontFamilyBtn.innerHTML = 'Aa';
      fontFamilyBtn.onclick = (e) => {
        e.stopPropagation();
        this.showFontFamilyMenu(element, noteId, fontFamilyBtn);
      };
      controls.appendChild(fontFamilyBtn);

      // Color picker
      const colorBtn = document.createElement('button');
      colorBtn.className = 'text-note-btn text-note-color';
      colorBtn.title = 'Text color';
      colorBtn.style.backgroundColor = color;
      colorBtn.onclick = (e) => {
        e.stopPropagation();
        this.showColorMenu(element, noteId, colorBtn);
      };
      controls.appendChild(colorBtn);

      // Close button
      const closeBtn = document.createElement('button');
      closeBtn.className = 'text-note-close';
      closeBtn.title = 'Delete note';
      closeBtn.innerHTML = `
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      `;
      closeBtn.onclick = (e) => {
        e.stopPropagation();
        this.onClose?.(noteId);
      };
      controls.appendChild(closeBtn);

      header.appendChild(controls);
    }

    element.appendChild(header);

    // Content area
    const contentArea = document.createElement('div');
    contentArea.className = 'text-note-content';
    
    if (isLocal) {
      const textarea = document.createElement('textarea');
      textarea.className = 'text-note-textarea';
      textarea.placeholder = 'Type your note here...';
      textarea.value = content;
      textarea.style.fontSize = FONT_SIZES[fontSize];
      textarea.style.fontFamily = FONT_FAMILIES[fontFamily];
      textarea.style.color = color;
      textarea.oninput = () => {
        this.onContentUpdate?.(noteId, textarea.value);
      };
      contentArea.appendChild(textarea);

      // Make resizable
      element.style.resize = 'both';
      element.style.overflow = 'hidden';

      // Observe resize
      const resizeObserver = new ResizeObserver((entries) => {
        for (const entry of entries) {
          const { width, height } = entry.contentRect;
          this.onSizeUpdate?.(noteId, Math.round(width), Math.round(height));
        }
      });
      resizeObserver.observe(element);
    } else {
      const contentDiv = document.createElement('div');
      contentDiv.className = 'text-note-text';
      contentDiv.textContent = content;
      contentDiv.style.fontSize = FONT_SIZES[fontSize];
      contentDiv.style.fontFamily = FONT_FAMILIES[fontFamily];
      contentDiv.style.color = color;
      contentArea.appendChild(contentDiv);
    }

    element.appendChild(contentArea);

    // Setup drag (only for owner)
    if (isLocal) {
      this.setupDrag(element, noteId, header);
    }

    this.space!.appendChild(element);
    this.textNotes.set(noteId, element);

    // Apply any pending state
    const pending = this.pendingState.get(noteId);
    if (pending) {
      if (pending.x !== undefined && pending.y !== undefined) {
        element.style.left = `${pending.x}px`;
        element.style.top = `${pending.y}px`;
      }
      if (pending.width !== undefined && pending.height !== undefined) {
        element.style.width = `${pending.width}px`;
        element.style.height = `${pending.height}px`;
      }
      if (pending.content !== undefined) {
        this.setContent(noteId, pending.content);
      }
      if (pending.fontSize !== undefined) {
        this.setFontSize(noteId, pending.fontSize);
      }
      if (pending.fontFamily !== undefined) {
        this.setFontFamily(noteId, pending.fontFamily);
      }
      if (pending.color !== undefined) {
        this.setColor(noteId, pending.color);
      }
      this.pendingState.delete(noteId);
    }

    console.log('[TextNote] Created with noteId:', noteId);
  }

  private showFontSizeMenu(element: HTMLDivElement, noteId: string, btn: HTMLButtonElement): void {
    // Remove existing menu if any
    const existingMenu = element.querySelector('.text-note-menu');
    if (existingMenu) {
      existingMenu.remove();
      return;
    }

    const menu = document.createElement('div');
    menu.className = 'text-note-menu';
    
    (['small', 'medium', 'large'] as const).forEach(size => {
      const option = document.createElement('button');
      option.className = 'text-note-menu-option';
      option.textContent = size.charAt(0).toUpperCase() + size.slice(1);
      option.style.fontSize = FONT_SIZES[size];
      option.onclick = (e) => {
        e.stopPropagation();
        this.setFontSize(noteId, size);
        this.onStyleUpdate?.(noteId, size, this.getColor(noteId));
        menu.remove();
      };
      menu.appendChild(option);
    });

    btn.appendChild(menu);
    
    // Close on outside click
    const closeMenu = (e: MouseEvent) => {
      if (!menu.contains(e.target as Node)) {
        menu.remove();
        document.removeEventListener('click', closeMenu);
      }
    };
    setTimeout(() => document.addEventListener('click', closeMenu), 0);
  }

  private showColorMenu(element: HTMLDivElement, noteId: string, btn: HTMLButtonElement): void {
    const existingMenu = element.querySelector('.text-note-menu');
    if (existingMenu) {
      existingMenu.remove();
      return;
    }

    const menu = document.createElement('div');
    menu.className = 'text-note-menu text-note-color-menu';
    
    COLOR_PALETTE.forEach(({ name, value }) => {
      const option = document.createElement('button');
      option.className = 'text-note-color-option';
      option.style.backgroundColor = value;
      option.title = name;
      option.onclick = (e) => {
        e.stopPropagation();
        this.setColor(noteId, value);
        btn.style.backgroundColor = value;
        this.onStyleUpdate?.(noteId, this.getFontSize(noteId), value);
        menu.remove();
      };
      menu.appendChild(option);
    });

    btn.appendChild(menu);
    
    const closeMenu = (e: MouseEvent) => {
      if (!menu.contains(e.target as Node)) {
        menu.remove();
        document.removeEventListener('click', closeMenu);
      }
    };
    setTimeout(() => document.addEventListener('click', closeMenu), 0);
  }

  private showFontFamilyMenu(element: HTMLDivElement, noteId: string, btn: HTMLButtonElement): void {
    const existingMenu = element.querySelector('.text-note-menu');
    if (existingMenu) {
      existingMenu.remove();
      return;
    }

    const menu = document.createElement('div');
    menu.className = 'text-note-menu';
    
    const families: { name: string; value: 'sans' | 'serif' | 'mono' }[] = [
      { name: 'Sans', value: 'sans' },
      { name: 'Serif', value: 'serif' },
      { name: 'Mono', value: 'mono' },
    ];
    
    families.forEach(({ name, value }) => {
      const option = document.createElement('button');
      option.className = 'text-note-menu-option';
      option.textContent = name;
      option.style.fontFamily = FONT_FAMILIES[value];
      option.onclick = (e) => {
        e.stopPropagation();
        this.setFontFamily(noteId, value);
        this.onStyleUpdate?.(noteId, this.getFontSize(noteId), this.getColor(noteId));
        menu.remove();
      };
      menu.appendChild(option);
    });

    btn.appendChild(menu);
    
    const closeMenu = (e: MouseEvent) => {
      if (!menu.contains(e.target as Node)) {
        menu.remove();
        document.removeEventListener('click', closeMenu);
      }
    };
    setTimeout(() => document.addEventListener('click', closeMenu), 0);
  }

  private setupDrag(element: HTMLDivElement, noteId: string, handle: HTMLElement): void {
    let isDragging = false;
    let startX = 0;
    let startY = 0;
    let initialLeft = 0;
    let initialTop = 0;

    handle.style.cursor = 'grab';

    handle.addEventListener('mousedown', (e: MouseEvent) => {
      if ((e.target as HTMLElement).closest('.text-note-btn, .text-note-close')) return;
      
      isDragging = true;
      startX = e.clientX;
      startY = e.clientY;
      initialLeft = parseFloat(element.style.left) || 0;
      initialTop = parseFloat(element.style.top) || 0;
      handle.style.cursor = 'grabbing';
      e.preventDefault();
    });

    document.addEventListener('mousemove', (e: MouseEvent) => {
      if (!isDragging) return;
      
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      
      const newX = Math.max(0, initialLeft + dx);
      const newY = Math.max(0, initialTop + dy);
      
      element.style.left = `${newX}px`;
      element.style.top = `${newY}px`;
    });

    document.addEventListener('mouseup', () => {
      if (isDragging) {
        isDragging = false;
        handle.style.cursor = 'grab';
        
        const x = parseFloat(element.style.left) || 0;
        const y = parseFloat(element.style.top) || 0;
        this.onPositionUpdate?.(noteId, Math.round(x), Math.round(y));
      }
    });
  }

  private getColor(noteId: string): string {
    const element = this.textNotes.get(noteId);
    if (!element) return '#ffffff';
    const textarea = element.querySelector('.text-note-textarea') as HTMLTextAreaElement;
    const textDiv = element.querySelector('.text-note-text') as HTMLDivElement;
    return (textarea?.style.color || textDiv?.style.color || '#ffffff');
  }

  private getFontSize(noteId: string): 'small' | 'medium' | 'large' {
    const element = this.textNotes.get(noteId);
    if (!element) return 'medium';
    const textarea = element.querySelector('.text-note-textarea') as HTMLTextAreaElement;
    const textDiv = element.querySelector('.text-note-text') as HTMLDivElement;
    const size = textarea?.style.fontSize || textDiv?.style.fontSize || '18px';
    
    if (size === '14px') return 'small';
    if (size === '24px') return 'large';
    return 'medium';
  }

  setPosition(noteId: string, x: number, y: number): void {
    const element = this.textNotes.get(noteId);
    if (element) {
      element.style.left = `${x}px`;
      element.style.top = `${y}px`;
    } else {
      const pending = this.pendingState.get(noteId) || {};
      this.pendingState.set(noteId, { ...pending, x, y });
    }
  }

  setSize(noteId: string, width: number, height: number): void {
    const element = this.textNotes.get(noteId);
    if (element) {
      element.style.width = `${width}px`;
      element.style.height = `${height}px`;
    } else {
      const pending = this.pendingState.get(noteId) || {};
      this.pendingState.set(noteId, { ...pending, width, height });
    }
  }

  setContent(noteId: string, content: string): void {
    const element = this.textNotes.get(noteId);
    if (element) {
      const textarea = element.querySelector('.text-note-textarea') as HTMLTextAreaElement;
      const textDiv = element.querySelector('.text-note-text') as HTMLDivElement;
      if (textarea && textarea.value !== content) {
        textarea.value = content;
      }
      if (textDiv) {
        textDiv.textContent = content;
      }
    } else {
      const pending = this.pendingState.get(noteId) || {};
      this.pendingState.set(noteId, { ...pending, content });
    }
  }

  setFontSize(noteId: string, fontSize: 'small' | 'medium' | 'large'): void {
    const element = this.textNotes.get(noteId);
    if (element) {
      const textarea = element.querySelector('.text-note-textarea') as HTMLTextAreaElement;
      const textDiv = element.querySelector('.text-note-text') as HTMLDivElement;
      if (textarea) textarea.style.fontSize = FONT_SIZES[fontSize];
      if (textDiv) textDiv.style.fontSize = FONT_SIZES[fontSize];
    } else {
      const pending = this.pendingState.get(noteId) || {};
      this.pendingState.set(noteId, { ...pending, fontSize });
    }
  }

  setFontFamily(noteId: string, fontFamily: 'sans' | 'serif' | 'mono'): void {
    const element = this.textNotes.get(noteId);
    if (element) {
      const textarea = element.querySelector('.text-note-textarea') as HTMLTextAreaElement;
      const textDiv = element.querySelector('.text-note-text') as HTMLDivElement;
      if (textarea) textarea.style.fontFamily = FONT_FAMILIES[fontFamily];
      if (textDiv) textDiv.style.fontFamily = FONT_FAMILIES[fontFamily];
    } else {
      const pending = this.pendingState.get(noteId) || {};
      this.pendingState.set(noteId, { ...pending, fontFamily });
    }
  }

  private getFontFamily(noteId: string): 'sans' | 'serif' | 'mono' {
    const element = this.textNotes.get(noteId);
    if (!element) return 'sans';
    const textarea = element.querySelector('.text-note-textarea') as HTMLTextAreaElement;
    const textDiv = element.querySelector('.text-note-text') as HTMLDivElement;
    const family = textarea?.style.fontFamily || textDiv?.style.fontFamily || '';
    
    if (family.includes('serif') && !family.includes('sans')) return 'serif';
    if (family.includes('mono')) return 'mono';
    return 'sans';
  }

  setColor(noteId: string, color: string): void {
    const element = this.textNotes.get(noteId);
    if (element) {
      const textarea = element.querySelector('.text-note-textarea') as HTMLTextAreaElement;
      const textDiv = element.querySelector('.text-note-text') as HTMLDivElement;
      if (textarea) textarea.style.color = color;
      if (textDiv) textDiv.style.color = color;
    } else {
      const pending = this.pendingState.get(noteId) || {};
      this.pendingState.set(noteId, { ...pending, color });
    }
  }

  removeTextNote(noteId: string): void {
    const element = this.textNotes.get(noteId);
    if (element) {
      element.remove();
      this.textNotes.delete(noteId);
      console.log('[TextNote] Removed:', noteId);
    }
  }

  removeTextNotesByPeerId(peerId: string): void {
    for (const [noteId, element] of this.textNotes) {
      if (element.dataset.peerId === peerId) {
        element.remove();
        this.textNotes.delete(noteId);
        console.log('[TextNote] Removed by peerId:', noteId);
      }
    }
  }

  clear(): void {
    this.textNotes.forEach((element) => element.remove());
    this.textNotes.clear();
  }
}

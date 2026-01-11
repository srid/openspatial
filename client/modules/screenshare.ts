type PositionUpdateCallback = (shareId: string, x: number, y: number) => void;
type ResizeUpdateCallback = (shareId: string, width: number, height: number) => void;
type CloseCallback = (shareId: string) => void;

interface AppState {
  peerId: string | null;
}

export class ScreenShareManager {
  private state: AppState;
  private screenShares = new Map<string, HTMLDivElement>();
  private space: HTMLElement | null = null;
  private onPositionUpdate: PositionUpdateCallback | null;
  private onResizeUpdate: ResizeUpdateCallback | null;
  private onClose: CloseCallback | null;
  private resizeObserver: ResizeObserver | null = null;
  // Pending state from CRDT for screen shares not yet created
  private pendingState = new Map<string, { x?: number; y?: number; width?: number; height?: number }>();

  constructor(
    state: AppState,
    onPositionUpdate: PositionUpdateCallback | null,
    onResizeUpdate: ResizeUpdateCallback | null,
    onClose: CloseCallback | null
  ) {
    this.state = state;
    this.onPositionUpdate = onPositionUpdate;
    this.onResizeUpdate = onResizeUpdate;
    this.onClose = onClose;

    // Create resize observer for local screen shares
    this.resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const element = entry.target as HTMLDivElement;
        const shareId = element.dataset.shareId;
        const peerId = element.dataset.peerId;
        
        // Only emit resize for local screen shares
        if (shareId && peerId === this.state.peerId && this.onResizeUpdate) {
          const width = element.offsetWidth;
          const height = element.offsetHeight;
          this.onResizeUpdate(shareId, width, height);
        }
      }
    });
  }

  createScreenShare(shareId: string, peerId: string, username: string, stream: MediaStream, x: number, y: number): void {
    this.space = document.getElementById('space');

    this.removeScreenShare(shareId);

    const isLocal = peerId === this.state.peerId;

    const element = document.createElement('div') as HTMLDivElement;
    element.className = 'screen-share';
    element.dataset.shareId = shareId;
    element.dataset.peerId = peerId;
    element.style.left = `${x}px`;
    element.style.top = `${y}px`;
    element.style.width = '480px';
    element.style.height = '320px';
    
    // Enable CSS resize for local screen shares only
    if (isLocal) {
      element.style.resize = 'both';
      element.style.overflow = 'hidden';
    }

    element.innerHTML = `
      <div class="screen-share-header">
        <div class="screen-share-title">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/>
            <line x1="8" y1="21" x2="16" y2="21"/>
            <line x1="12" y1="17" x2="12" y2="21"/>
          </svg>
          <span>${isLocal ? 'Your Screen' : `${username}'s Screen`}</span>
        </div>
        <div style="display: flex; gap: 4px;">
          <button class="screen-share-copy" title="Copy Snapshot">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path>
              <circle cx="12" cy="13" r="4"></circle>
            </svg>
          </button>
          <button class="screen-share-close" title="Stop Sharing">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
      </div>
    `;

    const video = document.createElement('video');
    video.srcObject = stream;
    video.autoplay = true;
    video.playsInline = true;
    video.muted = isLocal;
    element.appendChild(video);

    // Only allow drag for local screen shares (owner only)
    if (isLocal) {
      this.setupDrag(element, shareId);
    }

    const closeBtn = element.querySelector('.screen-share-close') as HTMLButtonElement;
    const copyBtn = element.querySelector('.screen-share-copy') as HTMLButtonElement;

    if (isLocal && this.onClose) {
      closeBtn.addEventListener('click', () => {
        this.onClose!(shareId);
      });
    } else {
      closeBtn.style.display = 'none';
    }

    const copyIconHTML = copyBtn.innerHTML;
    copyBtn.addEventListener('click', async (e) => {
      e.stopPropagation(); // Prevent drag

      try {
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        ctx.drawImage(video, 0, 0);

        const blob = await new Promise<Blob | null>(resolve =>
          canvas.toBlob(resolve, 'image/png')
        );

        if (blob) {
          await navigator.clipboard.write([
            new ClipboardItem({ 'image/png': blob })
          ]);

          // Visual feedback
          copyBtn.innerHTML = `
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#22c55e" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
          `;
          setTimeout(() => {
            copyBtn.innerHTML = copyIconHTML;
          }, 2000);
        }
      } catch (err) {
        console.error('Failed to copy snapshot:', err);
      }
    });

    this.space!.appendChild(element);
    this.screenShares.set(shareId, element);
    
    // Apply any pending CRDT state that arrived before the element was created
    const pending = this.pendingState.get(shareId);
    if (pending) {
      if (pending.x !== undefined && pending.y !== undefined) {
        element.style.left = `${pending.x}px`;
        element.style.top = `${pending.y}px`;
      }
      if (pending.width !== undefined && pending.height !== undefined) {
        element.style.width = `${pending.width}px`;
        element.style.height = `${pending.height}px`;
      }
      this.pendingState.delete(shareId);
    }
    
    // Observe resize for local screen shares
    if (isLocal && this.resizeObserver) {
      this.resizeObserver.observe(element);
    }
    
    console.log('[ScreenShare] Created with shareId:', shareId);
  }

  private setupDrag(element: HTMLDivElement, shareId: string): void {
    const header = element.querySelector('.screen-share-header') as HTMLElement;
    let isDragging = false;
    let startX = 0, startY = 0;
    let initialLeft = 0, initialTop = 0;

    header.addEventListener('mousedown', (e) => {
      if ((e.target as HTMLElement).closest('.screen-share-close')) return;

      e.stopPropagation();
      isDragging = true;
      startX = e.clientX;
      startY = e.clientY;
      initialLeft = parseInt(element.style.left) || 0;
      initialTop = parseInt(element.style.top) || 0;
      header.style.cursor = 'grabbing';
      element.style.zIndex = '15';
    });

    document.addEventListener('mousemove', (e) => {
      if (!isDragging) return;

      const deltaX = e.clientX - startX;
      const deltaY = e.clientY - startY;

      element.style.left = `${initialLeft + deltaX}px`;
      element.style.top = `${initialTop + deltaY}px`;
    });

    document.addEventListener('mouseup', () => {
      if (isDragging) {
        isDragging = false;
        header.style.cursor = 'grab';
        element.style.zIndex = '5';

        if (this.onPositionUpdate) {
          const x = parseInt(element.style.left) || 0;
          const y = parseInt(element.style.top) || 0;
          this.onPositionUpdate(shareId, x, y);
        }
      }
    });
  }

  setPosition(shareId: string, x: number, y: number): void {
    const element = this.screenShares.get(shareId);
    if (element) {
      element.style.left = `${x}px`;
      element.style.top = `${y}px`;
    } else {
      // Store pending state for when element is created
      const pending = this.pendingState.get(shareId) || {};
      this.pendingState.set(shareId, { ...pending, x, y });
    }
  }

  setSize(shareId: string, width: number, height: number): void {
    const element = this.screenShares.get(shareId);
    if (element) {
      element.style.width = `${width}px`;
      element.style.height = `${height}px`;
    } else {
      // Store pending state for when element is created
      const pending = this.pendingState.get(shareId) || {};
      this.pendingState.set(shareId, { ...pending, width, height });
    }
  }

  removeScreenShare(shareId: string): void {
    const element = this.screenShares.get(shareId);
    if (element) {
      element.remove();
      this.screenShares.delete(shareId);
    }
  }

  removeScreenSharesByPeerId(peerId: string): void {
    // Find all screen shares belonging to this peer and remove them
    const sharesToRemove: string[] = [];
    this.screenShares.forEach((element, shareId) => {
      if (element.dataset.peerId === peerId) {
        sharesToRemove.push(shareId);
      }
    });
    sharesToRemove.forEach((shareId) => this.removeScreenShare(shareId));
  }

  clear(): void {
    this.screenShares.forEach((element) => element.remove());
    this.screenShares.clear();
  }
}

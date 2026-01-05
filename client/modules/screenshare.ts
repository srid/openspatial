type PositionUpdateCallback = (shareId: string, x: number, y: number) => void;
type CloseCallback = (shareId: string) => void;

interface AppState {
  peerId: string | null;
}

export class ScreenShareManager {
  private state: AppState;
  private screenShares = new Map<string, HTMLDivElement>();
  private space: HTMLElement | null = null;
  private onPositionUpdate: PositionUpdateCallback | null;
  private onClose: CloseCallback | null;

  constructor(state: AppState, onPositionUpdate: PositionUpdateCallback | null, onClose: CloseCallback | null) {
    this.state = state;
    this.onPositionUpdate = onPositionUpdate;
    this.onClose = onClose;
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
        <button class="screen-share-close" title="Stop Sharing">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"/>
            <line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>
    `;

    const video = document.createElement('video');
    video.srcObject = stream;
    video.autoplay = true;
    video.playsInline = true;
    video.muted = isLocal;
    element.appendChild(video);

    this.setupDrag(element, shareId);

    const closeBtn = element.querySelector('.screen-share-close') as HTMLButtonElement;
    if (isLocal && this.onClose) {
      closeBtn.addEventListener('click', () => {
        this.onClose!(shareId);
      });
    } else {
      closeBtn.style.display = 'none';
    }

    this.space!.appendChild(element);
    this.screenShares.set(shareId, element);
    console.log('[ScreenShare] Created with shareId:', shareId, 'Map size:', this.screenShares.size);
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
    console.log('[ScreenShare] setPosition called with shareId:', shareId);
    console.log('[ScreenShare] Current keys:', [...this.screenShares.keys()]);
    const element = this.screenShares.get(shareId);
    if (element) {
      element.style.left = `${x}px`;
      element.style.top = `${y}px`;
      console.log('[ScreenShare] Position updated successfully');
    } else {
      console.warn('[ScreenShare] Element NOT FOUND for shareId:', shareId);
    }
  }

  removeScreenShare(shareId: string): void {
    const element = this.screenShares.get(shareId);
    if (element) {
      element.remove();
      this.screenShares.delete(shareId);
    }
  }

  clear(): void {
    this.screenShares.forEach((element) => element.remove());
    this.screenShares.clear();
  }
}

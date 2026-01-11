import type { Position } from '../../shared/types/events.js';

type PositionChangeCallback = (peerId: string, x: number, y: number) => void;
type StatusChangeCallback = (status: string) => void;

interface AppState {
  peerId: string | null;
  username: string;
}

export class AvatarManager {
  private state: AppState;
  private avatars = new Map<string, HTMLDivElement>();
  private positions = new Map<string, Position>();
  private positionChangeCallback: PositionChangeCallback | null = null;
  private statusChangeCallback: StatusChangeCallback | null = null;
  private statusPopover: HTMLElement | null = null;
  private space: HTMLElement | null = null;

  constructor(state: AppState) {
    this.state = state;
  }

  createLocalAvatar(peerId: string, username: string, stream: MediaStream, x: number, y: number): void {
    this.space = document.getElementById('space');

    const avatar = this.createAvatarElement(peerId, username, true);
    avatar.classList.add('self');

    const video = document.createElement('video');
    video.srcObject = stream;
    video.autoplay = true;
    video.muted = true;
    video.playsInline = true;

    const container = avatar.querySelector('.avatar-video-container') as HTMLElement;
    container.appendChild(video);

    this.space!.appendChild(avatar);
    this.avatars.set(peerId, avatar);

    this.setPosition(peerId, x, y);
    this.setupDrag(avatar, peerId);
    this.setupStatusEditor(avatar);
  }

  createRemoteAvatar(peerId: string, username: string, x: number, y: number): void {
    this.space = document.getElementById('space');

    const avatar = this.createAvatarElement(peerId, username, false);

    const container = avatar.querySelector('.avatar-video-container') as HTMLElement;
    const placeholder = document.createElement('div');
    placeholder.className = 'avatar-placeholder';
    placeholder.textContent = username.charAt(0).toUpperCase();
    container.appendChild(placeholder);

    this.space!.appendChild(avatar);
    this.avatars.set(peerId, avatar);

    this.setPosition(peerId, x, y);
  }

  private createAvatarElement(peerId: string, username: string, isLocal: boolean): HTMLDivElement {
    const avatar = document.createElement('div') as HTMLDivElement;
    avatar.className = 'avatar';
    avatar.dataset.peerId = peerId;

    // For local avatar, include a clickable status trigger
    const statusHtml = isLocal 
      ? `<div class="avatar-status-trigger" title="Click to set status">
           <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
             <circle cx="12" cy="12" r="10"/>
             <line x1="12" y1="8" x2="12" y2="16"/>
             <line x1="8" y1="12" x2="16" y2="12"/>
           </svg>
         </div>
         <div class="avatar-status"></div>`
      : `<div class="avatar-status"></div>`;

    avatar.innerHTML = `
      <div class="avatar-video-container"></div>
      <div class="avatar-name">${isLocal ? `${username} (You)` : username}</div>
      ${statusHtml}
      <div class="avatar-indicators"></div>
    `;

    return avatar;
  }

  setRemoteStream(peerId: string, stream: MediaStream): void {
    const avatar = this.avatars.get(peerId);
    if (!avatar) return;

    const container = avatar.querySelector('.avatar-video-container') as HTMLElement;
    
    // Check if video should be hidden (CRDT state set isVideoOff before stream arrived)
    const isVideoOff = avatar.dataset.isVideoOff === 'true';

    let video = container.querySelector('video');
    if (!video) {
      video = document.createElement('video');
      video.autoplay = true;
      video.muted = true;  // Audio handled by SpatialAudio pipeline for distance-based attenuation
      video.playsInline = true;
      container.appendChild(video);
    }

    video.srcObject = stream;
    
    // Respect the isVideoOff state from CRDT
    // If video should be off, keep placeholder and hide video
    if (isVideoOff) {
      video.style.display = 'none';
      // Placeholder should already exist from updateMediaState, but ensure it's there
      let placeholder = container.querySelector('.avatar-placeholder');
      if (!placeholder) {
        const nameEl = avatar.querySelector('.avatar-name') as HTMLElement;
        const name = nameEl.textContent || 'U';
        placeholder = document.createElement('div');
        placeholder.className = 'avatar-placeholder';
        placeholder.textContent = name.charAt(0).toUpperCase();
        container.appendChild(placeholder);
      }
    } else {
      // Video is on, remove placeholder if present
      const placeholder = container.querySelector('.avatar-placeholder');
      if (placeholder) {
        placeholder.remove();
      }
    }
  }

  setPosition(peerId: string, x: number, y: number): void {
    this.positions.set(peerId, { x, y });

    const avatar = this.avatars.get(peerId);
    if (avatar) {
      avatar.style.left = `${x - 60}px`;
      avatar.style.top = `${y - 60}px`;
    }
  }

  updatePosition(peerId: string, x: number, y: number): void {
    this.setPosition(peerId, x, y);
  }

  getPosition(peerId: string): Position {
    return this.positions.get(peerId) || { x: 2000, y: 2000 };
  }

  getPositions(): Map<string, Position> {
    return this.positions;
  }

  hasAvatar(peerId: string): boolean {
    return this.avatars.has(peerId);
  }

  /**
   * Update the local avatar's peerId after reconnection.
   * The server assigns a new peerId on each connection.
   */
  updateLocalPeerId(oldPeerId: string, newPeerId: string): void {
    // Re-key the avatar
    const avatar = this.avatars.get(oldPeerId);
    if (avatar) {
      this.avatars.delete(oldPeerId);
      this.avatars.set(newPeerId, avatar);
      avatar.dataset.peerId = newPeerId;
    }

    // Re-key the position
    const position = this.positions.get(oldPeerId);
    if (position) {
      this.positions.delete(oldPeerId);
      this.positions.set(newPeerId, position);
    }
  }

  private setupDrag(avatar: HTMLDivElement, peerId: string): void {
    let isDragging = false;
    let startX = 0, startY = 0;
    let initialLeft = 0, initialTop = 0;

    avatar.addEventListener('mousedown', (e) => {
      e.stopPropagation();
      isDragging = true;
      startX = e.clientX;
      startY = e.clientY;
      initialLeft = parseInt(avatar.style.left) || 0;
      initialTop = parseInt(avatar.style.top) || 0;
      avatar.style.cursor = 'grabbing';
      avatar.style.zIndex = '20';
    });

    document.addEventListener('mousemove', (e) => {
      if (!isDragging) return;

      const deltaX = e.clientX - startX;
      const deltaY = e.clientY - startY;

      const newLeft = initialLeft + deltaX;
      const newTop = initialTop + deltaY;

      avatar.style.left = `${newLeft}px`;
      avatar.style.top = `${newTop}px`;

      const newX = newLeft + 60;
      const newY = newTop + 60;
      this.positions.set(peerId, { x: newX, y: newY });

      if (this.positionChangeCallback) {
        this.positionChangeCallback(peerId, newX, newY);
      }
    });

    document.addEventListener('mouseup', () => {
      if (isDragging) {
        isDragging = false;
        avatar.style.cursor = 'grab';
        avatar.style.zIndex = '10';
      }
    });
  }

  onPositionChange(callback: PositionChangeCallback): void {
    this.positionChangeCallback = callback;
  }

  onStatusChange(callback: StatusChangeCallback): void {
    this.statusChangeCallback = callback;
  }

  private setupStatusEditor(avatar: HTMLDivElement): void {
    const statusTrigger = avatar.querySelector('.avatar-status-trigger') as HTMLElement;
    const statusEl = avatar.querySelector('.avatar-status') as HTMLElement;
    
    if (!statusTrigger || !statusEl) return;

    // Click on trigger (+ button) to open editor
    statusTrigger.addEventListener('click', (e) => {
      e.stopPropagation();
      this.showStatusPopover(avatar);
    });

    // Click on existing status to edit
    statusEl.addEventListener('click', (e) => {
      e.stopPropagation();
      this.showStatusPopover(avatar);
    });
  }

  private showStatusPopover(avatar: HTMLDivElement): void {
    // Remove existing popover if any
    this.hideStatusPopover();

    const statusEl = avatar.querySelector('.avatar-status') as HTMLElement;
    const currentStatus = statusEl?.textContent || '';

    // Create popover
    const popover = document.createElement('div');
    popover.className = 'status-popover';
    popover.innerHTML = `
      <input type="text" class="status-popover-input" placeholder="What's your status?" maxlength="50" value="${currentStatus}">
      <div class="status-popover-actions">
        <button class="status-popover-btn status-popover-save" title="Save">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
        </button>
        <button class="status-popover-btn status-popover-clear" title="Clear status">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"/>
            <line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>
    `;

    avatar.appendChild(popover);
    this.statusPopover = popover;

    const input = popover.querySelector('.status-popover-input') as HTMLInputElement;
    const saveBtn = popover.querySelector('.status-popover-save') as HTMLButtonElement;
    const clearBtn = popover.querySelector('.status-popover-clear') as HTMLButtonElement;

    // Focus the input
    setTimeout(() => input.focus(), 0);

    // Save on button click or Enter
    const save = () => {
      const newStatus = input.value.trim();
      if (this.statusChangeCallback) {
        this.statusChangeCallback(newStatus);
      }
      this.hideStatusPopover();
    };

    const clear = () => {
      if (this.statusChangeCallback) {
        this.statusChangeCallback('');
      }
      this.hideStatusPopover();
    };

    saveBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      save();
    });

    clearBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      clear();
    });

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        save();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        this.hideStatusPopover();
      }
    });

    // Close on click outside (after a short delay to avoid immediate close)
    setTimeout(() => {
      const closeOnOutsideClick = (e: MouseEvent) => {
        if (!popover.contains(e.target as Node)) {
          this.hideStatusPopover();
          document.removeEventListener('mousedown', closeOnOutsideClick);
        }
      };
      document.addEventListener('mousedown', closeOnOutsideClick);
    }, 10);
  }

  private hideStatusPopover(): void {
    if (this.statusPopover) {
      this.statusPopover.remove();
      this.statusPopover = null;
    }
  }

  updateMediaState(peerId: string, isMuted: boolean, isVideoOff: boolean): void {
    const avatar = this.avatars.get(peerId);
    if (!avatar) return;
    
    // Store video off state as data attribute for later reference by setRemoteStream
    avatar.dataset.isVideoOff = String(isVideoOff);

    const indicators = avatar.querySelector('.avatar-indicators') as HTMLElement;
    indicators.innerHTML = '';

    if (isMuted) {
      const mutedIndicator = document.createElement('div');
      mutedIndicator.className = 'avatar-indicator muted';
      mutedIndicator.innerHTML = `
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="1" y1="1" x2="23" y2="23"/>
          <path d="M9 9v3a3 3 0 0 0 5.12 2.12"/>
        </svg>
      `;
      indicators.appendChild(mutedIndicator);
    }

    const container = avatar.querySelector('.avatar-video-container') as HTMLElement;
    const video = container.querySelector('video');
    let placeholder = container.querySelector('.avatar-placeholder') as HTMLElement | null;

    if (isVideoOff) {
      if (video) video.style.display = 'none';
      if (!placeholder) {
        const nameEl = avatar.querySelector('.avatar-name') as HTMLElement;
        const name = nameEl.textContent || 'U';
        placeholder = document.createElement('div');
        placeholder.className = 'avatar-placeholder';
        placeholder.textContent = name.charAt(0).toUpperCase();
        container.appendChild(placeholder);
      }
    } else {
      if (video) video.style.display = 'block';
      if (placeholder) placeholder.remove();
    }
  }

  setSpeaking(peerId: string, isSpeaking: boolean): void {
    const avatar = this.avatars.get(peerId);
    if (avatar) {
      avatar.classList.toggle('speaking', isSpeaking);
    }
  }

  updateStatus(peerId: string, status: string): void {
    const avatar = this.avatars.get(peerId);
    if (!avatar) return;

    const statusEl = avatar.querySelector('.avatar-status') as HTMLElement;
    const statusTrigger = avatar.querySelector('.avatar-status-trigger') as HTMLElement;
    
    if (statusEl) {
      statusEl.textContent = status;
      statusEl.style.display = status ? 'block' : 'none';
    }
    
    // Hide trigger when status is set (for local avatar)
    if (statusTrigger) {
      statusTrigger.style.display = status ? 'none' : 'flex';
    }
  }

  removeAvatar(peerId: string): void {
    const avatar = this.avatars.get(peerId);
    if (avatar) {
      avatar.remove();
      this.avatars.delete(peerId);
      this.positions.delete(peerId);
    }
  }

  clear(): void {
    this.avatars.forEach((avatar) => avatar.remove());
    this.avatars.clear();
    this.positions.clear();
  }
}

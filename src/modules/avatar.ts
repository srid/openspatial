import type { Position } from '../types/events.js';

type PositionChangeCallback = (peerId: string, x: number, y: number) => void;

interface AppState {
  peerId: string | null;
  username: string;
}

export class AvatarManager {
  private state: AppState;
  private avatars = new Map<string, HTMLDivElement>();
  private positions = new Map<string, Position>();
  private positionChangeCallback: PositionChangeCallback | null = null;
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

    avatar.innerHTML = `
      <div class="avatar-video-container"></div>
      <div class="avatar-name">${isLocal ? `${username} (You)` : username}</div>
      <div class="avatar-indicators"></div>
    `;

    return avatar;
  }

  setRemoteStream(peerId: string, stream: MediaStream): void {
    const avatar = this.avatars.get(peerId);
    if (!avatar) return;

    const container = avatar.querySelector('.avatar-video-container') as HTMLElement;

    const placeholder = container.querySelector('.avatar-placeholder');
    if (placeholder) {
      placeholder.remove();
    }

    let video = container.querySelector('video');
    if (!video) {
      video = document.createElement('video');
      video.autoplay = true;
      video.playsInline = true;
      container.appendChild(video);
    }

    video.srcObject = stream;
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

  updateMediaState(peerId: string, isMuted: boolean, isVideoOff: boolean): void {
    const avatar = this.avatars.get(peerId);
    if (!avatar) return;

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

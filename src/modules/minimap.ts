import type { CanvasManager } from './canvas.js';

export class MinimapManager {
  private canvas: CanvasManager;
  private spaceWidth: number;
  private spaceHeight: number;
  private minimapSize = 180;
  private scale: number;
  private element: HTMLElement | null = null;
  private viewportRect: HTMLElement | null = null;
  private dotsContainer: HTMLElement | null = null;
  private isDragging = false;

  constructor(canvasManager: CanvasManager, spaceWidth: number, spaceHeight: number) {
    this.canvas = canvasManager;
    this.spaceWidth = spaceWidth;
    this.spaceHeight = spaceHeight;
    this.scale = this.minimapSize / Math.max(spaceWidth, spaceHeight);
  }

  init(): void {
    this.createMinimapElement();
    this.setupEvents();
    this.startUpdating();
  }

  private createMinimapElement(): void {
    this.element = document.createElement('div');
    this.element.className = 'minimap';
    this.element.innerHTML = `
      <div class="minimap-content">
        <div class="minimap-viewport"></div>
        <div class="minimap-dots"></div>
      </div>
    `;

    document.getElementById('canvas-container')!.appendChild(this.element);
    this.viewportRect = this.element.querySelector('.minimap-viewport');
    this.dotsContainer = this.element.querySelector('.minimap-dots');
  }

  private setupEvents(): void {
    const content = this.element!.querySelector('.minimap-content') as HTMLElement;

    content.addEventListener('mousedown', (e) => {
      e.stopPropagation();
      this.isDragging = true;
      this.panToMinimapPosition(e);
    });

    document.addEventListener('mousemove', (e) => {
      if (this.isDragging) {
        this.panToMinimapPosition(e);
      }
    });

    document.addEventListener('mouseup', () => {
      this.isDragging = false;
    });
  }

  private panToMinimapPosition(e: MouseEvent): void {
    const rect = this.element!.querySelector('.minimap-content')!.getBoundingClientRect();
    const x = (e.clientX - rect.left) / this.scale;
    const y = (e.clientY - rect.top) / this.scale;

    const clampedX = Math.max(0, Math.min(this.spaceWidth, x));
    const clampedY = Math.max(0, Math.min(this.spaceHeight, y));

    this.canvas.centerOn(clampedX, clampedY);
  }

  private startUpdating(): void {
    const update = (): void => {
      this.updateViewport();
      this.updateDots();
      requestAnimationFrame(update);
    };
    requestAnimationFrame(update);
  }

  private updateViewport(): void {
    const container = document.getElementById('canvas-container');
    if (!container) return;

    const containerRect = container.getBoundingClientRect();

    const topLeft = this.canvas.screenToSpace(0, 0);
    const bottomRight = this.canvas.screenToSpace(containerRect.width, containerRect.height);

    const left = Math.max(0, topLeft.x) * this.scale;
    const top = Math.max(0, topLeft.y) * this.scale;
    const width = Math.min(this.spaceWidth, bottomRight.x - topLeft.x) * this.scale;
    const height = Math.min(this.spaceHeight, bottomRight.y - topLeft.y) * this.scale;

    this.viewportRect!.style.left = `${left}px`;
    this.viewportRect!.style.top = `${top}px`;
    this.viewportRect!.style.width = `${Math.max(10, width)}px`;
    this.viewportRect!.style.height = `${Math.max(10, height)}px`;
  }

  private updateDots(): void {
    const avatars = document.querySelectorAll('.avatar') as NodeListOf<HTMLElement>;
    const screenShares = document.querySelectorAll('.screen-share') as NodeListOf<HTMLElement>;

    this.dotsContainer!.innerHTML = '';

    avatars.forEach((avatar) => {
      const left = parseInt(avatar.style.left) || 0;
      const top = parseInt(avatar.style.top) || 0;
      const x = (left + 60) * this.scale;
      const y = (top + 60) * this.scale;

      const dot = document.createElement('div');
      dot.className = 'minimap-dot minimap-dot-avatar';
      dot.style.left = `${x}px`;
      dot.style.top = `${y}px`;
      this.dotsContainer!.appendChild(dot);
    });

    screenShares.forEach((share) => {
      const left = parseInt(share.style.left) || 0;
      const top = parseInt(share.style.top) || 0;
      const width = parseInt(share.style.width) || 480;
      const height = parseInt(share.style.height) || 320;

      const x = left * this.scale;
      const y = top * this.scale;
      const w = Math.max(4, width * this.scale);
      const h = Math.max(3, height * this.scale);

      const rect = document.createElement('div');
      rect.className = 'minimap-dot minimap-dot-screen';
      rect.style.left = `${x}px`;
      rect.style.top = `${y}px`;
      rect.style.width = `${w}px`;
      rect.style.height = `${h}px`;
      this.dotsContainer!.appendChild(rect);
    });
  }
}

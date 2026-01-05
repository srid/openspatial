export class CanvasManager {
  private container: HTMLElement | null = null;
  private space: HTMLElement | null = null;
  private isDragging = false;
  private startX = 0;
  private startY = 0;
  private scale = 1;
  private offsetX = 0;
  private offsetY = 0;
  private spaceWidth = 4000;
  private spaceHeight = 4000;

  init(): void {
    this.container = document.getElementById('canvas-container');
    this.space = document.getElementById('space');

    this.setupPanning();
    this.setupZoom();

    this.centerOn(this.spaceWidth / 2, this.spaceHeight / 2);
  }

  private setupPanning(): void {
    this.container!.addEventListener('mousedown', (e) => {
      if (e.target === this.container || e.target === this.space) {
        this.isDragging = true;
        this.startX = e.pageX;
        this.startY = e.pageY;
        this.container!.style.cursor = 'grabbing';
      }
    });

    document.addEventListener('mousemove', (e) => {
      if (!this.isDragging) return;

      e.preventDefault();
      const deltaX = e.pageX - this.startX;
      const deltaY = e.pageY - this.startY;

      this.offsetX += deltaX;
      this.offsetY += deltaY;

      this.clampOffset();
      this.updateTransform();

      this.startX = e.pageX;
      this.startY = e.pageY;
    });

    document.addEventListener('mouseup', () => {
      this.isDragging = false;
      if (this.container) {
        this.container.style.cursor = 'grab';
      }
    });
  }

  private setupZoom(): void {
    this.container!.addEventListener(
      'wheel',
      (e) => {
        e.preventDefault();

        const delta = e.deltaY > 0 ? 0.9 : 1.1;
        const newScale = Math.min(Math.max(this.scale * delta, 0.25), 2);

        const rect = this.container!.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        this.offsetX = mouseX - (mouseX - this.offsetX) * (newScale / this.scale);
        this.offsetY = mouseY - (mouseY - this.offsetY) * (newScale / this.scale);

        this.scale = newScale;
        this.clampOffset();
        this.updateTransform();
      },
      { passive: false }
    );
  }

  private clampOffset(): void {
    const containerRect = this.container!.getBoundingClientRect();
    const scaledWidth = this.spaceWidth * this.scale;
    const scaledHeight = this.spaceHeight * this.scale;

    const maxOffsetX = 0;
    const minOffsetX = Math.min(0, containerRect.width - scaledWidth);
    const maxOffsetY = 0;
    const minOffsetY = Math.min(0, containerRect.height - scaledHeight);

    this.offsetX = Math.max(minOffsetX, Math.min(maxOffsetX, this.offsetX));
    this.offsetY = Math.max(minOffsetY, Math.min(maxOffsetY, this.offsetY));
  }

  private updateTransform(): void {
    this.space!.style.transform = `translate(${this.offsetX}px, ${this.offsetY}px) scale(${this.scale})`;
  }

  centerOn(x: number, y: number): void {
    const containerRect = this.container!.getBoundingClientRect();
    this.offsetX = containerRect.width / 2 - x * this.scale;
    this.offsetY = containerRect.height / 2 - y * this.scale;
    this.clampOffset();
    this.updateTransform();
  }

  screenToSpace(screenX: number, screenY: number): { x: number; y: number } {
    return {
      x: (screenX - this.offsetX) / this.scale,
      y: (screenY - this.offsetY) / this.scale,
    };
  }

  spaceToScreen(spaceX: number, spaceY: number): { x: number; y: number } {
    return {
      x: spaceX * this.scale + this.offsetX,
      y: spaceY * this.scale + this.offsetY,
    };
  }

  getScale(): number {
    return this.scale;
  }

  getOffset(): { x: number; y: number } {
    return { x: this.offsetX, y: this.offsetY };
  }
}

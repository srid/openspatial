/**
 * E2E Test DSL - View Classes
 * 
 * These provide typed access to avatar and screen share state.
 */
import { Page, expect } from '@playwright/test';
import { Position, Size, Rect, AvatarState, AvatarView, ScreenShareView, TextNoteView } from './types';

const SYNC_TIMEOUT = 5000;

export class AvatarViewImpl implements AvatarView {
  constructor(
    private page: Page,
    private targetName: string,
    private isSelf: boolean
  ) {}

  private get locator() {
    if (this.isSelf) {
      return this.page.locator('.avatar.self');
    }
    return this.page.locator(`.avatar:has-text("${this.targetName}")`);
  }

  async position(): Promise<Position> {
    await expect(this.locator).toBeVisible({ timeout: SYNC_TIMEOUT });
    return await this.locator.evaluate((el: HTMLElement) => ({
      x: parseFloat(el.style.left) || 0,
      y: parseFloat(el.style.top) || 0,
    }));
  }

  async isMuted(): Promise<boolean> {
    const indicator = this.locator.locator('.avatar-indicator.muted');
    try {
      await expect(indicator).toBeVisible({ timeout: SYNC_TIMEOUT });
      return true;
    } catch {
      return false;
    }
  }

  async isWebcamOn(): Promise<boolean> {
    // Webcam is on if video element is visible (not hidden by isVideoOff)
    const video = this.locator.locator('.avatar-video-container video');
    try {
      await expect(video).toBeVisible({ timeout: SYNC_TIMEOUT });
      // Also check that video has a srcObject (stream attached)
      const hasStream = await video.evaluate((el: HTMLVideoElement) => !!el.srcObject);
      return hasStream;
    } catch {
      return false;
    }
  }

  async isWebcamMuted(): Promise<boolean> {
    const indicator = this.locator.locator('.avatar-indicator.webcam-muted');
    try {
      await expect(indicator).toBeVisible({ timeout: SYNC_TIMEOUT });
      return true;
    } catch {
      return false;
    }
  }

  async status(): Promise<string | null> {
    const statusEl = this.locator.locator('.avatar-status');
    try {
      await expect(statusEl).toBeVisible({ timeout: SYNC_TIMEOUT });
      return await statusEl.textContent();
    } catch {
      return null;
    }
  }

  async state(): Promise<AvatarState> {
    const [position, isMuted, isWebcamOn, isWebcamMuted, status] = await Promise.all([
      this.position(),
      this.isMuted(),
      this.isWebcamOn(),
      this.isWebcamMuted(),
      this.status(),
    ]);
    return { position, isMuted, isWebcamOn, isWebcamMuted, status };
  }
}

export class ScreenShareViewImpl implements ScreenShareView {
  constructor(
    private page: Page,
    private owner: string
  ) {}

  private get locator() {
    return this.page.locator(`.screen-share:has-text("${this.owner}")`);
  }

  async rect(): Promise<Rect> {
    await expect(this.locator).toBeVisible({ timeout: SYNC_TIMEOUT });
    return await this.locator.evaluate((el: HTMLElement) => ({
      position: {
        x: parseFloat(el.style.left) || 0,
        y: parseFloat(el.style.top) || 0,
      },
      size: {
        width: parseFloat(el.style.width) || 0,
        height: parseFloat(el.style.height) || 0,
      },
    }));
  }

  async size(): Promise<Size> {
    const r = await this.rect();
    return r.size;
  }

  async position(): Promise<Position> {
    const r = await this.rect();
    return r.position;
  }

  /**
   * Verify the video element has actual content (not blank/black).
   * Waits for video to receive frames, then samples pixels to check for non-black values.
   */
  async hasVideoContent(): Promise<boolean> {
    await expect(this.locator).toBeVisible({ timeout: SYNC_TIMEOUT });
    const video = this.locator.locator('.screen-share-video');
    await expect(video).toBeVisible({ timeout: SYNC_TIMEOUT });
    
    // Wait for video to have dimensions (frames have arrived)
    // Poll for up to 5 seconds for WebRTC frames to arrive
    const maxWaitMs = 5000;
    const pollIntervalMs = 200;
    let attempts = 0;
    const maxAttempts = maxWaitMs / pollIntervalMs;
    
    while (attempts < maxAttempts) {
      const state = await video.evaluate((el: HTMLVideoElement) => ({
        videoWidth: el.videoWidth,
        videoHeight: el.videoHeight,
        readyState: el.readyState,
      }));
      
      if (state.videoWidth > 0 && state.videoHeight > 0 && state.readyState >= 2) {
        // Video has dimensions and at least HAVE_CURRENT_DATA
        break;
      }
      
      attempts++;
      await new Promise(r => setTimeout(r, pollIntervalMs));
    }
    
    // Log final state for debugging
    const debugInfo = await video.evaluate((el: HTMLVideoElement) => {
      const stream = el.srcObject as MediaStream | null;
      const tracks = stream?.getVideoTracks() || [];
      const trackInfo = tracks.map(t => ({
        kind: t.kind,
        enabled: t.enabled,
        muted: t.muted,
        readyState: t.readyState,
        id: t.id?.substring(0, 8),
      }));
      return {
        hasSrcObject: !!el.srcObject,
        videoWidth: el.videoWidth,
        videoHeight: el.videoHeight,
        readyState: el.readyState,
        paused: el.paused,
        trackCount: tracks.length,
        tracks: trackInfo,
      };
    });
    console.log(`[hasVideoContent DEBUG after wait] ${JSON.stringify(debugInfo)}`);
    
    return await video.evaluate((el: HTMLVideoElement) => {
      // Check for dimensions
      if (el.videoWidth === 0 || el.videoHeight === 0) {
        return false;
      }
      if (el.paused || el.ended) {
        return false;
      }
      
      // Sample pixels from the video by drawing to a canvas
      const canvas = document.createElement('canvas');
      canvas.width = Math.min(el.videoWidth, 100);
      canvas.height = Math.min(el.videoHeight, 100);
      const ctx = canvas.getContext('2d');
      if (!ctx) return false;
      
      ctx.drawImage(el, 0, 0, canvas.width, canvas.height);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const pixels = imageData.data;
      
      // Check if any pixels have non-black/non-transparent content
      let nonBlackPixels = 0;
      for (let i = 0; i < pixels.length; i += 40) { // Sample every 10th pixel
        const r = pixels[i];
        const g = pixels[i + 1];
        const b = pixels[i + 2];
        const a = pixels[i + 3];
        
        if (a > 0 && (r > 10 || g > 10 || b > 10)) {
          nonBlackPixels++;
        }
      }
      
      const totalSampled = Math.floor(pixels.length / 40);
      return nonBlackPixels > totalSampled * 0.05;
    });
  }
}

export class TextNoteViewImpl implements TextNoteView {
  constructor(
    private page: Page
  ) {}

  private get locator() {
    // Notes are ownerless - just get first text note
    return this.page.locator('.text-note').first();
  }

  async content(): Promise<string> {
    await expect(this.locator).toBeVisible({ timeout: SYNC_TIMEOUT });
    const textarea = this.locator.locator('.text-note-textarea');
    return await textarea.inputValue();
  }

  async rect(): Promise<Rect> {
    await expect(this.locator).toBeVisible({ timeout: SYNC_TIMEOUT });
    return await this.locator.evaluate((el: HTMLElement) => ({
      position: {
        x: parseFloat(el.style.left) || 0,
        y: parseFloat(el.style.top) || 0,
      },
      size: {
        width: parseFloat(el.style.width) || 0,
        height: parseFloat(el.style.height) || 0,
      },
    }));
  }

  async style(): Promise<{ fontSize: 'small' | 'medium' | 'large'; fontFamily: 'sans' | 'serif' | 'mono'; color: string }> {
    await expect(this.locator).toBeVisible({ timeout: SYNC_TIMEOUT });
    return await this.locator.evaluate((el: HTMLElement) => {
      const textarea = el.querySelector('.text-note-textarea') as HTMLTextAreaElement;
      const computedStyle = textarea ? window.getComputedStyle(textarea) : null;
      
      // Reverse map font sizes
      const fontSize = (() => {
        const size = computedStyle?.fontSize || '18px';
        if (size === '14px') return 'small';
        if (size === '24px') return 'large';
        return 'medium';
      })();
      
      // Reverse map font families
      const fontFamily = (() => {
        const family = computedStyle?.fontFamily || '';
        if (family.includes('Georgia') || family.includes('Times')) return 'serif';
        if (family.includes('Mono') || family.includes('Consolas') || family.includes('monospace')) return 'mono';
        return 'sans';
      })();
      
      // Get color from textarea inline style (rgb or hex)
      const color = textarea?.style.color || '#ffffff';
      
      return { fontSize, fontFamily, color };
    });
  }
}

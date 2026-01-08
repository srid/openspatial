/**
 * E2E Test DSL - View Classes
 * 
 * These provide typed access to avatar and screen share state.
 */
import { Page, expect } from '@playwright/test';
import { Position, Size, Rect, AvatarState, AvatarView, ScreenShareView } from './types';

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
}

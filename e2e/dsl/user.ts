/**
 * E2E Test DSL - User Class
 * 
 * Wraps Playwright Page with domain-specific actions and queries.
 */
import { Page, expect } from '@playwright/test';
import {
  User,
  Position,
  ConnectionStatus,
  ScreenShareInfo,
  Rect,
  AvatarView,
  ScreenShareView,
} from './types';
import { AvatarViewImpl, ScreenShareViewImpl } from './views';
import { mockScreenShare } from './mocks';

const SYNC_TIMEOUT = 10000;
const SYNC_WAIT = 500;

export class UserImpl implements User {
  constructor(
    public readonly name: string,
    private page: Page
  ) {}

  // ─────────────────────────────────────────────────────────────────
  // Actions
  // ─────────────────────────────────────────────────────────────────

  async leave(): Promise<void> {
    await this.page.click('#btn-leave');
  }

  async mute(): Promise<void> {
    await this.page.click('#btn-mic');
  }

  async unmute(): Promise<void> {
    await this.page.click('#btn-mic');
  }

  async toggleWebcam(): Promise<void> {
    await this.page.click('#btn-camera');
  }

  async muteWebcam(): Promise<void> {
    // Toggle webcam mute (assumes webcam is on)
    await this.page.click('#btn-webcam-mute');
  }

  async unmuteWebcam(): Promise<void> {
    await this.page.click('#btn-webcam-mute');
  }

  async setStatus(text: string): Promise<void> {
    await this.page.fill('#status-input', text);
    await this.page.click('#btn-set-status');
  }

  async clearStatus(): Promise<void> {
    await this.page.click('#btn-clear-status');
  }

  async startScreenShare(opts?: { color?: string }): Promise<ScreenShareInfo> {
    await mockScreenShare(this.page, opts?.color ?? 'blue');
    await this.page.click('#btn-screen');
    await this.page.waitForTimeout(1000);

    // Return info about the created screen share
    const rect = await this.screenShareOf(this.name).rect();
    return {
      id: `${this.name}-screen`,
      owner: this.name,
      rect,
    };
  }

  async stopScreenShare(): Promise<void> {
    // Click the close button on our own screen share
    const screenShare = this.page.locator('.screen-share:has-text("Your Screen")');
    const closeBtn = screenShare.locator('.screen-share-close');
    await closeBtn.click();
  }

  async resizeScreenShare(rect: Rect): Promise<void> {
    const screenShare = this.page.locator('.screen-share:has-text("Your Screen")');
    const box = await screenShare.boundingBox();
    if (box) {
      // Drag from current bottom-right to new size
      const resizeHandleX = box.x + box.width - 5;
      const resizeHandleY = box.y + box.height - 5;
      const targetX = box.x + rect.size.width - 5;
      const targetY = box.y + rect.size.height - 5;

      await this.page.mouse.move(resizeHandleX, resizeHandleY);
      await this.page.mouse.down();
      await this.page.mouse.move(targetX, targetY, { steps: 5 });
      await this.page.mouse.up();
    }
    await this.page.waitForTimeout(SYNC_WAIT);
  }

  async dragAvatar(delta: { dx: number; dy: number }): Promise<void> {
    const avatar = this.page.locator('.avatar.self');
    const box = await avatar.boundingBox();
    if (box) {
      await this.page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await this.page.mouse.down();
      await this.page.mouse.move(
        box.x + box.width / 2 + delta.dx,
        box.y + box.height / 2 + delta.dy,
        { steps: 5 }
      );
      await this.page.mouse.up();
    }
    // Longer wait to ensure CRDT sync propagates
    await this.page.waitForTimeout(1000);
  }

  async goOffline(): Promise<void> {
    await this.page.evaluate(() => {
      window.dispatchEvent(new Event('offline'));
    });
  }

  async goOnline(): Promise<void> {
    await this.page.evaluate(() => {
      window.dispatchEvent(new Event('online'));
    });
  }

  // ─────────────────────────────────────────────────────────────────
  // Queries
  // ─────────────────────────────────────────────────────────────────

  /**
   * Wait for another user's avatar to be visible.
   * Use this before making assertions about other users.
   */
  async waitForUser(name: string): Promise<void> {
    const avatar = this.page.locator(`.avatar:has-text("${name}")`);
    await expect(avatar).toBeVisible({ timeout: SYNC_TIMEOUT });
  }

  /**
   * Wait for a screen share from a specific owner to be visible.
   */
  async waitForScreenShare(owner: string): Promise<void> {
    const labelText = owner === this.name ? 'Your Screen' : `${owner}'s Screen`;
    const screenShare = this.page.locator('.screen-share', { hasText: labelText });
    await expect(screenShare).toBeVisible({ timeout: SYNC_TIMEOUT });
  }

  /**
   * Wait for a specified duration.
   */
  async wait(ms: number): Promise<void> {
    await this.page.waitForTimeout(ms);
  }

  async visibleUsers(): Promise<string[]> {
    // Wait a bit for any pending syncs
    await this.page.waitForTimeout(SYNC_WAIT);
    const avatars = this.page.locator('.avatar:not(.self) .avatar-name');
    const count = await avatars.count();
    const names: string[] = [];
    for (let i = 0; i < count; i++) {
      const text = await avatars.nth(i).textContent();
      if (text) names.push(text.trim());
    }
    return names.sort(); // Sort for consistent comparison
  }

  async screenShares(): Promise<ScreenShareInfo[]> {
    await this.page.waitForTimeout(SYNC_WAIT);
    const shares = this.page.locator('.screen-share');
    const count = await shares.count();
    const result: ScreenShareInfo[] = [];

    for (let i = 0; i < count; i++) {
      const share = shares.nth(i);
      const label = await share.locator('.screen-share-title span').textContent();
      const owner = label?.replace("'s Screen", '').replace('Your Screen', this.name).trim() ?? '';
      const rect = await share.evaluate((el: HTMLElement) => ({
        position: {
          x: parseFloat(el.style.left) || 0,
          y: parseFloat(el.style.top) || 0,
        },
        size: {
          width: parseFloat(el.style.width) || 0,
          height: parseFloat(el.style.height) || 0,
        },
      }));
      result.push({ id: `${owner}-screen`, owner, rect });
    }
    return result;
  }

  screenShareOf(owner: string): ScreenShareView {
    const displayOwner = owner === this.name ? 'Your Screen' : owner;
    return new ScreenShareViewImpl(this.page, displayOwner);
  }

  avatarOf(targetName: string): AvatarView {
    const isSelf = targetName === this.name;
    return new AvatarViewImpl(this.page, targetName, isSelf);
  }

  async participantCount(): Promise<number> {
    const countEl = this.page.locator('#participant-count');
    await expect(countEl).toBeVisible({ timeout: SYNC_TIMEOUT });
    const text = await countEl.textContent();
    return parseInt(text ?? '0', 10);
  }

  async connectionStatus(): Promise<ConnectionStatus> {
    const statusEl = this.page.locator('#connection-status');
    const classes = await statusEl.getAttribute('class');
    if (classes?.includes('disconnected')) {
      return 'disconnected';
    }
    return 'connected';
  }
}

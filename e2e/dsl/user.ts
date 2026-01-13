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
  TextNoteInfo,
  Rect,
  AvatarView,
  ScreenShareView,
  TextNoteView,
} from './types';
import { AvatarViewImpl, ScreenShareViewImpl, TextNoteViewImpl } from './views';
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
    // Click on the status trigger (+ button) or existing status badge on our avatar
    const avatar = this.page.locator('.avatar.self');
    const statusTrigger = avatar.locator('.avatar-status-trigger');
    const statusBadge = avatar.locator('.avatar-status');
    
    // Click whichever is visible (trigger if no status, badge if has status)
    if (await statusTrigger.isVisible()) {
      await statusTrigger.click();
    } else {
      await statusBadge.click();
    }
    
    // Fill in the popover input and save
    await this.page.fill('.status-popover-input', text);
    await this.page.click('.status-popover-save');
  }

  async clearStatus(): Promise<void> {
    // Click on the existing status badge to open the popover
    const avatar = this.page.locator('.avatar.self');
    const statusBadge = avatar.locator('.avatar-status');
    
    if (await statusBadge.isVisible()) {
      await statusBadge.click();
      await this.page.click('.status-popover-clear');
    }
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
    
    // Set width/height directly in style and trigger resize by updating the element
    await screenShare.evaluate((el: HTMLElement, size: { width: number; height: number }) => {
      el.style.width = `${size.width}px`;
      el.style.height = `${size.height}px`;
    }, { width: rect.size.width, height: rect.size.height });
    
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
  // Text Note Actions
  // ─────────────────────────────────────────────────────────────────

  async createTextNote(): Promise<TextNoteInfo> {
    await this.page.click('#btn-note');
    await this.page.waitForTimeout(500);

    // Return info about the created text note
    const rect = await this.textNoteOf(this.name).rect();
    const content = await this.textNoteOf(this.name).content();
    return {
      id: `${this.name}-note`,
      owner: this.name,
      content,
      rect,
    };
  }

  async editTextNote(content: string): Promise<void> {
    const note = this.page.locator('.text-note:has-text("Your Note")');
    const textarea = note.locator('.text-note-textarea');
    await textarea.fill(content);
    await this.page.waitForTimeout(SYNC_WAIT);
  }

  async deleteTextNote(): Promise<void> {
    const note = this.page.locator('.text-note:has-text("Your Note")');
    const closeBtn = note.locator('.text-note-close');
    await closeBtn.click();
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

  async waitForTextNote(owner: string): Promise<void> {
    const labelText = owner === this.name ? 'Your Note' : `${owner}'s Note`;
    const note = this.page.locator('.text-note', { hasText: labelText });
    await expect(note).toBeVisible({ timeout: SYNC_TIMEOUT });
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

  async textNotes(): Promise<TextNoteInfo[]> {
    await this.page.waitForTimeout(SYNC_WAIT);
    const notes = this.page.locator('.text-note');
    const count = await notes.count();
    const result: TextNoteInfo[] = [];

    for (let i = 0; i < count; i++) {
      const note = notes.nth(i);
      const label = await note.locator('.text-note-title span').textContent();
      const owner = label?.replace("'s Note", '').replace('Your Note', this.name).trim() ?? '';
      const content = await note.locator('.text-note-textarea, .text-note-text').first().textContent() || '';
      const rect = await note.evaluate((el: HTMLElement) => ({
        position: {
          x: parseFloat(el.style.left) || 0,
          y: parseFloat(el.style.top) || 0,
        },
        size: {
          width: parseFloat(el.style.width) || 0,
          height: parseFloat(el.style.height) || 0,
        },
      }));
      result.push({ id: `${owner}-note`, owner, content, rect });
    }
    return result;
  }

  textNoteOf(owner: string): TextNoteView {
    const isSelf = owner === this.name;
    return new TextNoteViewImpl(this.page, owner, isSelf);
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

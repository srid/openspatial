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

  /**
   * Rejoin the same space in the same page context (SPA navigation).
   * This tests the leave→rejoin flow without page reload.
   */
  async rejoin(): Promise<void> {
    // Fill in username (should be preserved) and submit join form
    await this.page.fill('#username', this.name);
    await this.page.locator('#join-form').evaluate((form: HTMLFormElement) => form.requestSubmit());
    // Wait for control bar to confirm we're back in the space
    await this.page.locator('#control-bar').waitFor({ state: 'visible', timeout: 10000 });
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

  async touchDragAvatar(delta: { dx: number; dy: number }): Promise<void> {
    const avatar = this.page.locator('.avatar.self');
    const box = await avatar.boundingBox();
    if (!box) return;

    const startX = box.x + box.width / 2;
    const startY = box.y + box.height / 2;
    const endX = startX + delta.dx;
    const endY = startY + delta.dy;

    // Use CDP (Chrome DevTools Protocol) for reliable touch simulation
    const client = await this.page.context().newCDPSession(this.page);
    
    // Touch start
    await client.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [{ x: startX, y: startY }],
    });

    // Touch move in steps
    const steps = 10;
    for (let i = 1; i <= steps; i++) {
      const x = startX + (endX - startX) * (i / steps);
      const y = startY + (endY - startY) * (i / steps);
      await client.send('Input.dispatchTouchEvent', {
        type: 'touchMove',
        touchPoints: [{ x, y }],
      });
    }

    // Touch end
    await client.send('Input.dispatchTouchEvent', {
      type: 'touchEnd',
      touchPoints: [],
    });

    // Wait for CRDT sync
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
    // Since notes are ownerless, just get the first/most recent text note
    const note = this.page.locator('.text-note').first();
    const textarea = note.locator('.text-note-textarea');
    await textarea.fill(content);
    await this.page.waitForTimeout(SYNC_WAIT);
  }

  async setTextNoteFontSize(size: 'small' | 'medium' | 'large'): Promise<void> {
    const note = this.page.locator('.text-note').first();
    // Click the font size button to open menu
    const fontSizeBtn = note.locator('.text-note-font-size');
    await fontSizeBtn.click();
    // Click the menu option with matching text
    const sizeLabel = size.charAt(0).toUpperCase() + size.slice(1); // 'small' -> 'Small'
    const option = this.page.locator('.text-note-menu-option', { hasText: sizeLabel });
    await option.click();
    await this.page.waitForTimeout(SYNC_WAIT);
  }

  async setTextNoteFontFamily(family: 'sans' | 'serif' | 'mono'): Promise<void> {
    const note = this.page.locator('.text-note').first();
    // Click the font family button to open menu
    const fontFamilyBtn = note.locator('.text-note-font-family');
    await fontFamilyBtn.click();
    // Click the menu option with matching text
    const familyLabels: Record<string, string> = { sans: 'Sans', serif: 'Serif', mono: 'Mono' };
    const option = this.page.locator('.text-note-menu-option', { hasText: familyLabels[family] });
    await option.click();
    await this.page.waitForTimeout(SYNC_WAIT);
  }

  async setTextNoteColor(color: string): Promise<void> {
    const note = this.page.locator('.text-note').first();
    // Click the color button to open menu
    const colorBtn = note.locator('.text-note-color');
    await colorBtn.click();
    // Click the color option - use title attribute which contains the color name
    // Colors: White=#ffffff, Yellow=#fef08a, Cyan=#67e8f9, Pink=#f9a8d4, Green=#86efac
    const colorNames: Record<string, string> = {
      '#ffffff': 'White', '#fef08a': 'Yellow', '#67e8f9': 'Cyan', '#f9a8d4': 'Pink', '#86efac': 'Green'
    };
    const colorName = colorNames[color] || 'White';
    const option = this.page.locator(`.text-note-color-option[title="${colorName}"]`);
    await option.click();
    await this.page.waitForTimeout(SYNC_WAIT);
  }

  async deleteTextNote(): Promise<void> {
    // Since notes are ownerless, just get the first/most recent text note
    const note = this.page.locator('.text-note').first();
    const closeBtn = note.locator('.text-note-close');
    await closeBtn.click();
  }

  async dragTextNote(delta: { dx: number; dy: number }): Promise<void> {
    const note = this.page.locator('.text-note').first();
    const header = note.locator('.text-note-header');
    
    // Get the note's current position and update it directly via style + CRDT
    const currentRect = await note.evaluate((el: HTMLElement) => ({
      left: parseFloat(el.style.left) || 0,
      top: parseFloat(el.style.top) || 0
    }));
    
    const newX = currentRect.left + delta.dx;
    const newY = currentRect.top + delta.dy;
    
    // Set new position and dispatch events to trigger CRDT update
    await note.evaluate((el: HTMLElement, pos: { x: number; y: number }) => {
      el.style.left = `${pos.x}px`;
      el.style.top = `${pos.y}px`;
      
      // Find the noteId from data attribute
      const noteId = el.dataset.noteId;
      if (noteId) {
        // Dispatch a custom event that the app can listen to
        // or try to simulate a mouseup on document
        document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
      }
    }, { x: newX, y: newY });
    
    // Also try using the mouse to perform a minimal drag
    const box = await header.boundingBox();
    if (box) {
      await this.page.mouse.move(box.x + 5, box.y + 5);
      await this.page.mouse.down();
      await this.page.mouse.move(box.x + 5 + delta.dx, box.y + 5 + delta.dy, { steps: 3 });
      await this.page.mouse.up();
    }
    
    await this.page.waitForTimeout(1500);
  }

  async resizeTextNote(size: { width: number; height: number }): Promise<void> {
    const note = this.page.locator('.text-note').first();
    // Trigger resize by interacting with the resize handle
    const resizeHandle = note.locator('.text-note-resize-handle');
    
    // If no resize handle, use evaluate to set size directly and trigger CRDT update
    if (await resizeHandle.count() === 0) {
      // Set size via style and dispatch a mouseup to trigger update
      await note.evaluate((el: HTMLElement, s: { width: number; height: number }) => {
        el.style.width = `${s.width}px`;
        el.style.height = `${s.height}px`;
        // Trigger the resize observer or dispatch event
        el.dispatchEvent(new Event('mouseup', { bubbles: true }));
      }, size);
    } else {
      // Use the resize handle if available
      const box = await resizeHandle.boundingBox();
      if (box) {
        await this.page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
        await this.page.mouse.down();
        await this.page.mouse.move(box.x + size.width, box.y + size.height, { steps: 5 });
        await this.page.mouse.up();
      }
    }
    await this.page.waitForTimeout(SYNC_WAIT);
  }

  //
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

  async waitForTextNote(_owner?: string): Promise<void> {
    // Notes are ownerless now - just wait for any text note (use first() to avoid strict mode)
    const note = this.page.locator('.text-note').first();
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
      // Notes are ownerless now
      const content = await note.locator('.text-note-textarea').first().inputValue() || '';
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
      result.push({ id: `note-${i}`, owner: 'shared', content, rect });
    }
    return result;
  }

  textNoteOf(_owner: string): TextNoteView {
    // Notes are ownerless now - return first note
    return new TextNoteViewImpl(this.page);
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

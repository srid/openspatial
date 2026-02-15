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
  ActivityItem,
} from './types';
import { AvatarViewImpl, ScreenShareViewImpl, TextNoteViewImpl } from './views';
import { mockScreenShare } from './mocks';

const SYNC_TIMEOUT = 10000;

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
    // Wait for the screen share element to appear on canvas
    const selfScreen = this.page.locator('.screen-share:has-text("Your Screen")');
    await expect(selfScreen).toBeVisible({ timeout: SYNC_TIMEOUT });

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

  async resizeScreenShare(rectOrOwner: Rect | string, sizeArg?: { width: number; height: number }): Promise<void> {
    // Handle both old signature (Rect) and new signature (owner, size)
    let screenShare;
    let size: { width: number; height: number };
    
    if (typeof rectOrOwner === 'string') {
      // New signature: resizeScreenShare(owner, { width, height })
      const owner = rectOrOwner;
      const labelText = owner === this.name ? 'Your Screen' : `${owner}'s Screen`;
      screenShare = this.page.locator('.screen-share', { hasText: labelText });
      size = sizeArg!;
    } else {
      // Old signature: resizeScreenShare(Rect) - for local screen share
      screenShare = this.page.locator('.screen-share:has-text("Your Screen")');
      size = rectOrOwner.size;
    }
    
    // Dispatch test-resize event to trigger CRDT update via component
    await screenShare.evaluate((el: HTMLElement, s: { width: number; height: number }) => {
      el.dispatchEvent(new CustomEvent('test-resize', { 
        detail: s,
        bubbles: true 
      }));
    }, size);
  }

  async dragScreenShare(owner: string, delta: { dx: number; dy: number }): Promise<void> {
    const labelText = owner === this.name ? 'Your Screen' : `${owner}'s Screen`;
    const screenShare = this.page.locator('.screen-share', { hasText: labelText });
    const header = screenShare.locator('.screen-share-header');
    
    const box = await header.boundingBox();
    if (box) {
      await this.page.mouse.move(box.x + 5, box.y + 5);
      await this.page.mouse.down();
      await this.page.mouse.move(box.x + 5 + delta.dx, box.y + 5 + delta.dy, { steps: 5 });
      await this.page.mouse.up();
    }
    await this.page.waitForTimeout(250);
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
    await this.page.waitForTimeout(250);
  }

  async touchDragAvatar(delta: { dx: number; dy: number }): Promise<void> {
    const avatar = this.page.locator('.avatar.self');
    const box = await avatar.boundingBox();
    if (!box) return;

    // Use Playwright's native mouse API which works better across browser contexts
    // Mobile viewport still responds to mouse events
    await this.page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await this.page.mouse.down();
    await this.page.mouse.move(
      box.x + box.width / 2 + delta.dx,
      box.y + box.height / 2 + delta.dy,
      { steps: 10 }
    );
    await this.page.mouse.up();

    await this.page.waitForTimeout(250);
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
    // Wait for the text note element to appear on canvas
    const newNote = this.page.locator('.text-note').first();
    await expect(newNote).toBeVisible({ timeout: SYNC_TIMEOUT });

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
    const editor = note.locator('.cm-content');
    
    // Use force: true because avatars may overlap the text note
    await editor.click({ force: true });
    // Explicitly focus to ensure keyboard events go to the editor
    await editor.focus();
    
    // Select all and delete to clear existing content (like the placeholder)
    await this.page.keyboard.press('ControlOrMeta+A');
    await this.page.keyboard.press('Backspace');
    
    await this.page.keyboard.type(content);
    // Click outside to blur
    await this.page.click('.text-note-header', { force: true });
  }

  async setTextNoteFontSize(size: 'small' | 'medium' | 'large'): Promise<void> {
    const note = this.page.locator('.text-note').first();
    // Click the font size button to open menu
    const fontSizeBtn = note.locator('.text-note-font-size');
    await fontSizeBtn.click({ force: true });
    // Click the menu option with matching text
    const sizeLabel = size.charAt(0).toUpperCase() + size.slice(1); // 'small' -> 'Small'
    const option = this.page.locator('.text-note-menu-option', { hasText: sizeLabel });
    await option.click({ force: true });
  }

  async setTextNoteFontFamily(family: 'sans' | 'serif' | 'mono'): Promise<void> {
    const note = this.page.locator('.text-note').first();
    // Click the font family button to open menu
    const fontFamilyBtn = note.locator('.text-note-font-family');
    await fontFamilyBtn.click({ force: true });
    // Click the menu option with matching text
    const familyLabels: Record<string, string> = { sans: 'Sans', serif: 'Serif', mono: 'Mono' };
    const option = this.page.locator('.text-note-menu-option', { hasText: familyLabels[family] });
    await option.click({ force: true });
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
    
    await this.page.waitForTimeout(250);
  }

  async resizeTextNote(size: { width: number; height: number }): Promise<void> {
    const note = this.page.locator('.text-note').first();
    
    // Dispatch test-resize event to trigger CRDT update via component
    await note.evaluate((el: HTMLElement, s: { width: number; height: number }) => {
      el.dispatchEvent(new CustomEvent('test-resize', { 
        detail: s,
        bubbles: true 
      }));
    }, size);
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
   * @deprecated Prefer declarative waiting (expect.poll / toBeVisible) over imperative waits.
   * Only use for simulating intentional user pauses (e.g., between disconnect/reconnect).
   */
  async wait(ms: number): Promise<void> {
    await this.page.waitForTimeout(ms);
  }

  async visibleUsers(): Promise<string[]> {
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
    const notes = this.page.locator('.text-note');
    const count = await notes.count();
    const result: TextNoteInfo[] = [];

    for (let i = 0; i < count; i++) {
      const note = notes.nth(i);
      // Notes are ownerless now
      // Read text content from CodeMirror lines, recursively walking Text nodes
      // but skipping yCollab widget containers
      const content = await note.locator('.cm-content').first().evaluate((el: HTMLElement) => {
        const SKIP_CLASSES = ['cm-ySelectionInfo', 'cm-ySelectionCaret', 'cm-widgetBuffer'];
        function extractText(node: Node): string {
          if (node.nodeType === Node.TEXT_NODE) return node.textContent || '';
          if (node.nodeType === Node.ELEMENT_NODE) {
            const elem = node as HTMLElement;
            if (SKIP_CLASSES.some(cls => elem.classList?.contains(cls))) return '';
            return Array.from(elem.childNodes).map(extractText).join('');
          }
          return '';
        }
        return Array.from(el.querySelectorAll('.cm-line')).map(line => extractText(line)).join('\n');
      }) || '';
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

  // ─────────────────────────────────────────────────────────────────
  // Activity Panel
  // ─────────────────────────────────────────────────────────────────

  async openActivityPanel(): Promise<void> {
    const panel = this.page.locator('#activity-panel');
    if (await panel.isHidden()) {
      await this.page.click('#btn-activity');
      await expect(panel).toBeVisible({ timeout: 5000 });
    }
  }

  async closeActivityPanel(): Promise<void> {
    const panel = this.page.locator('#activity-panel');
    if (await panel.isVisible()) {
      await this.page.click('#btn-activity');
      await expect(panel).toBeHidden({ timeout: 5000 });
    }
  }

  async activityItems(): Promise<ActivityItem[]> {
    const items = this.page.locator('.activity-item');
    const count = await items.count();
    const result: ActivityItem[] = [];

    for (let i = 0; i < count; i++) {
      const item = items.nth(i);
      const username = await item.locator('.activity-text strong').textContent() ?? '';
      const timeAgo = await item.locator('.activity-time').textContent() ?? '';
      const classes = await item.getAttribute('class') ?? '';
      
      let eventType: ActivityItem['eventType'] = 'join';
      // Check more specific types first since they contain the base type as substring
      if (classes.includes('join_first')) eventType = 'join_first';
      else if (classes.includes('leave_last')) eventType = 'leave_last';
      else if (classes.includes('join')) eventType = 'join';
      else if (classes.includes('leave')) eventType = 'leave';
      
      result.push({ username: username.trim(), eventType, timeAgo: timeAgo.trim() });
    }
    return result;
  }

  async isActivityBadgeVisible(): Promise<boolean> {
    const badge = this.page.locator('#activity-badge');
    return !(await badge.evaluate((el) => el.classList.contains('hidden')));
  }
}

/**
 * E2E Test DSL - Core Type Definitions
 */

export interface Position {
  x: number;
  y: number;
}

export interface Size {
  width: number;
  height: number;
}

export interface Rect {
  position: Position;
  size: Size;
}

export type ConnectionStatus = 'connected' | 'disconnected';

export interface AvatarState {
  isMuted: boolean;
  isWebcamOn: boolean;
  isWebcamMuted: boolean;
  status: string | null;
  position: Position;
}

export interface ScreenShareInfo {
  id: string;
  owner: string;
  rect: Rect;
}

export interface TextNoteInfo {
  id: string;
  owner: string;
  content: string;
  rect: Rect;
}

export interface ActivityItem {
  username: string;
  eventType: 'join_first' | 'join' | 'leave' | 'leave_last';
  timeAgo: string;
}

export type ScenarioFn = (ctx: ScenarioContext) => Promise<void>;

export interface ScenarioContext {
  createUser: (name: string) => UserBuilder;
}

export interface UserBuilder {
  join(): Promise<User>;
  /** Mock the webcam with an animated canvas stream before joining */
  withMockedWebcam(color?: string): UserBuilder;
}

export interface User {
  readonly name: string;

  // Actions
  leave(): Promise<void>;
  rejoin(): Promise<void>;
  mute(): Promise<void>;
  unmute(): Promise<void>;
  toggleWebcam(): Promise<void>;
  muteWebcam(): Promise<void>;
  unmuteWebcam(): Promise<void>;
  setStatus(text: string): Promise<void>;
  clearStatus(): Promise<void>;
  startScreenShare(opts?: { color?: string }): Promise<ScreenShareInfo>;
  stopScreenShare(): Promise<void>;
  resizeScreenShare(rect: Rect): Promise<void>;
  resizeScreenShare(owner: string, size: { width: number; height: number }): Promise<void>;
  dragScreenShare(owner: string, delta: { dx: number; dy: number }): Promise<void>;
  dragAvatar(delta: { dx: number; dy: number }): Promise<void>;
  touchDragAvatar(delta: { dx: number; dy: number }): Promise<void>;
  goOffline(): Promise<void>;
  goOnline(): Promise<void>;
  
  // Text Note Actions
  createTextNote(): Promise<TextNoteInfo>;
  editTextNote(content: string): Promise<void>;
  deleteTextNote(): Promise<void>;
  dragTextNote(delta: { dx: number; dy: number }): Promise<void>;
  resizeTextNote(size: Size): Promise<void>;
  setTextNoteFontSize(size: 'small' | 'medium' | 'large'): Promise<void>;
  setTextNoteFontFamily(family: 'sans' | 'serif' | 'mono'): Promise<void>;

  // Queries
  waitForUser(name: string): Promise<void>;
  waitForScreenShare(owner: string): Promise<void>;
  waitForTextNote(owner?: string): Promise<void>;
  /** @deprecated Prefer declarative waiting (expect.poll / toBeVisible). Only for intentional pauses. */
  wait(ms: number): Promise<void>;
  visibleUsers(): Promise<string[]>;
  screenShares(): Promise<ScreenShareInfo[]>;
  textNotes(): Promise<TextNoteInfo[]>;
  screenShareOf(owner: string): ScreenShareView;
  textNoteOf(owner: string): TextNoteView;
  avatarOf(name: string): AvatarView;
  participantCount(): Promise<number>;
  connectionStatus(): Promise<ConnectionStatus>;
  
  // Activity Panel
  openActivityPanel(): Promise<void>;
  closeActivityPanel(): Promise<void>;
  activityItems(): Promise<ActivityItem[]>;
  isActivityBadgeVisible(): Promise<boolean>;
}

export interface AvatarView {
  position(): Promise<Position>;
  state(): Promise<AvatarState>;
  isMuted(): Promise<boolean>;
  isWebcamOn(): Promise<boolean>;
  isWebcamMuted(): Promise<boolean>;
  status(): Promise<string | null>;
  /** Verify the webcam video element has actual content (not blank/black) */
  hasVideoContent(): Promise<boolean>;
}

export interface ScreenShareView {
  rect(): Promise<Rect>;
  size(): Promise<Size>;
  position(): Promise<Position>;
  /** Verify the video element has actual content (not blank/black) */
  hasVideoContent(): Promise<boolean>;
}

export interface TextNoteStyle {
  fontSize: 'small' | 'medium' | 'large';
  fontFamily: 'sans' | 'serif' | 'mono';
}

export interface TextNoteView {
  content(): Promise<string>;
  rect(): Promise<Rect>;
  style(): Promise<TextNoteStyle>;
}

// ─────────────────────────────────────────────────────────────────
// Assertion Helpers
// ─────────────────────────────────────────────────────────────────

import { expect } from '@playwright/test';

/**
 * Assert that two Rects are equal.
 */
export function expectRect(actual: Rect, expected: Rect): void {
  expect(actual.position.x).toBe(expected.position.x);
  expect(actual.position.y).toBe(expected.position.y);
  expect(actual.size.width).toBe(expected.size.width);
  expect(actual.size.height).toBe(expected.size.height);
}

/**
 * Assert that a position getter eventually returns the expected position.
 * Uses polling to wait for position sync.
 */
export async function expectPosition(
  getPosition: () => Promise<Position>,
  expected: Position,
  timeout = 5000
): Promise<void> {
  await expect.poll(async () => {
    const pos = await getPosition();
    return pos.x === expected.x && pos.y === expected.y;
  }, { timeout }).toBe(true);
}

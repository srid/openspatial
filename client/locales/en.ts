/**
 * English locale dictionary (default).
 * All UI-facing strings live here. Keys are camelCase.
 * Interpolation: {{param}} is replaced at runtime.
 */
const en = {
  // ── Landing ──────────────────────────────────────────────
  tagline: 'A virtual space where distance disappears',
  taglineDescription: 'Spatial audio and a shared infinite canvas for teams, friends, or communities.',
  enterSpace: 'Enter Space',
  leaveEmptyForDemo: 'Leave empty for demo space',
  viewOnGithub: 'View on GitHub',
  footerTagline: 'Open source · Self-hostable · WebRTC-powered',
  browserWarning: 'Warning: This application is tested on Chrome only. You may experience issues on other browsers.',

  // Landing features
  featureSpatialAudioTitle: 'Spatial Audio',
  featureSpatialAudioDesc: 'Voices get louder as you move closer, just like a real room. Walk up to someone to chat, or drift away for quiet focus.',
  featureScreenSharingTitle: 'Screen Sharing',
  featureScreenSharingDesc: 'Share your screen as a resizable, draggable window on the canvas — and everyone can do it at once. Multiple people, multiple shares, all visible simultaneously.',
  featureSharedCanvasTitle: 'Shared Canvas',
  featureSharedCanvasDesc: 'Drag your avatar around an infinite surface and drop notes — everyone sees and interacts with the same space in real time.',
  featureCollaborationTitle: 'Real-Time Collaboration',
  featureCollaborationDesc: 'Rich Markdown notes with syntax-highlighted code blocks, co-edited by everyone in the space with live cursors.',

  // ── JoinModal ────────────────────────────────────────────
  yourName: 'Your Name',
  enterYourName: 'Enter your name',
  joinSpace: 'Join Space',
  backToHome: 'Back to home',
  checkingSpace: 'Checking space...',
  noOneHere: 'No one here yet — be the first!',
  hereNow: 'Here now:',
  peopleHere: '{{count}} people here:',

  // ── ConnectionStatus ────────────────────────────────────
  connectionLost: 'Connection lost. Waiting to reconnect...',
  reconnecting: 'Reconnecting...',
  connected: 'Connected',

  // ── SpaceNotFound ────────────────────────────────────────
  spaceNotFound: 'Space not found',
  spaceDoesNotExist: 'The space "{{spaceId}}" doesn\'t exist.',
  contactAdmin: 'Contact your administrator to create this space.',
  goHome: 'Go Home',

  // ── ControlBar ──────────────────────────────────────────
  toggleMicrophone: 'Toggle Microphone',
  toggleCamera: 'Toggle Camera',
  shareScreen: 'Share Screen',
  addNote: 'Add Note',
  recentActivity: 'Recent Activity',
  leaveSpace: 'Leave Space',
  mediaBlockedError: "Camera/mic blocked. Click the 🔒 icon in your browser's address bar to allow access, then try again.",
  mediaError: 'Media error: {{errorName}}',

  // ── ActivityPanel ───────────────────────────────────────
  noRecentActivity: 'No recent activity',
  openedTheSpace: 'opened the space',
  joined: 'joined',
  left: 'left',
  closedTheSpace: 'closed the space',
  justNow: 'just now',
  minutesAgo: '{{count}}m ago',
  hoursAgo: '{{count}}h ago',
  daysAgo: '{{count}}d ago',

  // ── TextNote ────────────────────────────────────────────
  note: 'Note',
  fontSize: 'Font size',
  fontFamily: 'Font family',
  deleteNote: 'Delete note',

  // ── ScreenShare ─────────────────────────────────────────
  yourScreen: 'Your Screen',
  userScreen: "{{username}}'s Screen",
  copySnapshot: 'Copy Snapshot',
  stopSharing: 'Stop sharing',

  // ── CloseButton ─────────────────────────────────────────
  cancel: 'Cancel',
  delete: 'Delete',
  confirmDelete: 'Confirm delete',

  // ── Avatar ──────────────────────────────────────────────
  setStatus: 'Set status...',

  // ── Minimap ─────────────────────────────────────────────
  zoomIn: 'Zoom in',
  resetView: 'Reset view',
  zoomOut: 'Zoom out',
} as const;

export type TranslationKey = keyof typeof en;
export default en;

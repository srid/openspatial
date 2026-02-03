/**
 * ControlBar Component
 * Bottom control bar with media, screenshare, notes, activity, and leave buttons.
 * Renders the exact DOM structure expected by legacy modules (UIController).
 */
import { Show, type JSX, type Accessor, onMount } from 'solid-js';

export interface MediaState {
  isMuted: boolean;
  isVideoOff: boolean;
  isScreenSharing: boolean;
}

export interface ActivityState {
  hasUnread: boolean;
  isOpen: boolean;
}

interface ControlBarProps {
  media: Accessor<MediaState>;
  activity: Accessor<ActivityState>;
  onToggleMic: () => void;
  onToggleCamera: () => void;
  onToggleScreen: () => void;
  onAddNote: () => void;
  onToggleActivity: () => void;
  onLeave: () => void;
}

export function ControlBar(props: ControlBarProps): JSX.Element {
  return (
    <div id="control-bar">
      {/* Microphone */}
      <button
        id="btn-mic"
        class="control-btn"
        classList={{ muted: props.media().isMuted }}
        title="Toggle Microphone"
        onClick={props.onToggleMic}
      >
        <svg
          class="icon-on"
          classList={{ hidden: props.media().isMuted }}
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
        >
          <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
          <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
          <line x1="12" y1="19" x2="12" y2="23" />
          <line x1="8" y1="23" x2="16" y2="23" />
        </svg>
        <svg
          class="icon-off"
          classList={{ hidden: !props.media().isMuted }}
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
        >
          <line x1="1" y1="1" x2="23" y2="23" />
          <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6" />
          <path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2c0 .74-.11 1.46-.32 2.14" />
          <line x1="12" y1="19" x2="12" y2="23" />
          <line x1="8" y1="23" x2="16" y2="23" />
        </svg>
      </button>

      {/* Camera */}
      <button
        id="btn-camera"
        class="control-btn"
        classList={{ muted: props.media().isVideoOff }}
        title="Toggle Camera"
        onClick={props.onToggleCamera}
      >
        <svg
          class="icon-on"
          classList={{ hidden: props.media().isVideoOff }}
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
        >
          <path d="M23 7l-7 5 7 5V7z" />
          <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
        </svg>
        <svg
          class="icon-off"
          classList={{ hidden: !props.media().isVideoOff }}
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
        >
          <path d="M16 16v1a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h2m5.66 0H14a2 2 0 0 1 2 2v3.34l1 1L23 7v10" />
          <line x1="1" y1="1" x2="23" y2="23" />
        </svg>
      </button>

      {/* Screen Share */}
      <button
        id="btn-screen"
        class="control-btn"
        classList={{ active: props.media().isScreenSharing }}
        title="Share Screen"
        onClick={props.onToggleScreen}
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
          <line x1="8" y1="21" x2="16" y2="21" />
          <line x1="12" y1="17" x2="12" y2="21" />
        </svg>
      </button>

      {/* Add Note */}
      <button id="btn-note" class="control-btn" title="Add Note" onClick={props.onAddNote}>
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M12 20h9" />
          <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
        </svg>
      </button>

      <div class="control-divider" />

      {/* Activity */}
      <div id="activity-wrapper" class="activity-wrapper">
        <button id="btn-activity" class="control-btn" title="Recent Activity" onClick={props.onToggleActivity}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
          <span
            id="activity-badge"
            class="activity-badge"
            classList={{ hidden: !props.activity().hasUnread }}
          />
        </button>
        <div id="activity-panel" class="activity-panel hidden" />
      </div>

      <div class="control-divider" />

      {/* Leave */}
      <button id="btn-leave" class="control-btn control-btn-danger" title="Leave Space" onClick={props.onLeave}>
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
          <polyline points="16 17 21 12 16 7" />
          <line x1="21" y1="12" x2="9" y2="12" />
        </svg>
      </button>
    </div>
  );
}

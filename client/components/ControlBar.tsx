/**
 * ControlBar Component
 * Bottom control bar with media, screenshare, notes, activity, and leave buttons.
 */
import { Show, type JSX, type Accessor } from 'solid-js';
import {
  MicIcon, MicOffIcon, CameraIcon, CameraOffIcon,
  MonitorIcon, EditIcon, ClockIcon, LogOutIcon
} from './Icons';

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
        <Show when={!props.media().isMuted} fallback={<MicOffIcon />}>
          <MicIcon />
        </Show>
      </button>

      {/* Camera */}
      <button
        id="btn-camera"
        class="control-btn"
        classList={{ muted: props.media().isVideoOff }}
        title="Toggle Camera"
        onClick={props.onToggleCamera}
      >
        <Show when={!props.media().isVideoOff} fallback={<CameraOffIcon />}>
          <CameraIcon />
        </Show>
      </button>

      {/* Screen Share */}
      <button
        id="btn-screen"
        class="control-btn"
        classList={{ active: props.media().isScreenSharing }}
        title="Share Screen"
        onClick={props.onToggleScreen}
      >
        <MonitorIcon />
      </button>

      {/* Add Note */}
      <button
        id="btn-note"
        class="control-btn"
        title="Add Note"
        onClick={props.onAddNote}
      >
        <EditIcon />
      </button>

      <div class="control-divider" />

      {/* Activity */}
      <div id="activity-wrapper" class="activity-wrapper">
        <button
          id="btn-activity"
          class="control-btn"
          title="Recent Activity"
          onClick={props.onToggleActivity}
        >
          <ClockIcon />
          <Show when={props.activity().hasUnread}>
            <span id="activity-badge" class="activity-badge" />
          </Show>
        </button>
      </div>

      <div class="control-divider" />

      {/* Leave */}
      <button
        id="btn-leave"
        class="control-btn control-btn-danger"
        title="Leave Space"
        onClick={props.onLeave}
      >
        <LogOutIcon />
      </button>
    </div>
  );
}

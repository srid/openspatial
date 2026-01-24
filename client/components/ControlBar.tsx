/**
 * Control bar component — mic, camera, screen share, notes, leave
 */

import { Component, Show } from 'solid-js';
import { user } from '../stores/app';
import { MicIcon, MicOffIcon, VideoIcon, VideoOffIcon, ScreenIcon, PenIcon, LogOutIcon } from './Icons';

interface ControlBarProps {
  onToggleMic: () => void;
  onToggleCamera: () => void;
  onShareScreen: () => void;
  onAddNote: () => void;
  onLeave: () => void;
}

export const ControlBar: Component<ControlBarProps> = (props) => {
  return (
    <div id="control-bar">
      <button
        id="btn-mic"
        class="control-btn"
        classList={{ muted: user.isMuted() }}
        title="Toggle Microphone"
        onClick={props.onToggleMic}
      >
        <Show when={!user.isMuted()} fallback={<MicOffIcon class="icon-off" />}>
          <MicIcon class="icon-on" />
        </Show>
      </button>

      <button
        id="btn-camera"
        class="control-btn"
        classList={{ 'video-off': user.isVideoOff() }}
        title="Toggle Camera"
        onClick={props.onToggleCamera}
      >
        <Show when={!user.isVideoOff()} fallback={<VideoOffIcon class="icon-off" />}>
          <VideoIcon class="icon-on" />
        </Show>
      </button>

      <button
        id="btn-screen"
        class="control-btn"
        title="Share Screen"
        onClick={props.onShareScreen}
      >
        <ScreenIcon />
      </button>

      <button
        id="btn-note"
        class="control-btn"
        title="Add Note"
        onClick={props.onAddNote}
      >
        <PenIcon />
      </button>

      <div class="control-divider" />

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
};

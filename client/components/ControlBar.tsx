/**
 * ControlBar Component - Bottom control bar in space view
 */
import { Component } from 'solid-js';
import { MicIcon, MicOffIcon, VideoIcon, VideoOffIcon, ScreenShareIcon, NoteIcon, LeaveIcon } from './Icons';

interface ControlBarProps {
  isMuted: boolean;
  isVideoOff: boolean;
  isScreenSharing: boolean;
  onToggleMic: () => void;
  onToggleCamera: () => void;
  onToggleScreenShare: () => void;
  onCreateNote: () => void;
  onLeave: () => void;
}

export const ControlBar: Component<ControlBarProps> = (props) => {
  const btnBase = "flex items-center justify-center w-[52px] h-[52px] rounded-xl cursor-pointer transition-all duration-150";
  const btnNormal = "bg-white/5 border border-white/10 text-white hover:bg-white/10 hover:-translate-y-0.5";
  const btnActive = "bg-indigo-500 border-indigo-500 text-white shadow-lg shadow-indigo-500/40";
  const btnMuted = "bg-red-500/20 border border-red-500 text-red-500";
  const btnDanger = "text-red-500 hover:bg-red-500/20 hover:border-red-500";

  return (
    <div class="fixed bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-2 p-3 bg-slate-900/80 border border-white/10 rounded-3xl backdrop-blur-xl shadow-xl z-[100]">
      {/* Mic Button */}
      <button
        id="btn-mic"
        title="Toggle Microphone"
        class={`${btnBase} ${props.isMuted ? btnMuted : btnNormal}`}
        onClick={props.onToggleMic}
      >
        {props.isMuted ? <MicOffIcon /> : <MicIcon />}
      </button>

      {/* Camera Button */}
      <button
        id="btn-camera"
        title="Toggle Camera"
        class={`${btnBase} ${props.isVideoOff ? btnMuted : btnNormal}`}
        onClick={props.onToggleCamera}
      >
        {props.isVideoOff ? <VideoOffIcon /> : <VideoIcon />}
      </button>

      {/* Screen Share Button */}
      <button
        id="btn-screen"
        title="Share Screen"
        class={`${btnBase} ${props.isScreenSharing ? btnActive : btnNormal}`}
        onClick={props.onToggleScreenShare}
      >
        <ScreenShareIcon />
      </button>

      {/* Note Button */}
      <button
        id="btn-note"
        title="Add Note"
        class={`${btnBase} ${btnNormal}`}
        onClick={props.onCreateNote}
      >
        <NoteIcon />
      </button>

      {/* Divider */}
      <div class="w-px h-8 bg-white/10 mx-2" />

      {/* Leave Button */}
      <button
        id="btn-leave"
        title="Leave Space"
        class={`${btnBase} ${btnNormal} ${btnDanger}`}
        onClick={props.onLeave}
      >
        <LeaveIcon />
      </button>
    </div>
  );
};

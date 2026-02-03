/**
 * Avatar Component
 * Pure render from store - no DOM manipulation.
 */
import { type JSX, Show, createSignal, createEffect, onCleanup } from 'solid-js';
import type { Participant } from '../store/space';
import { broadcastPosition } from '../store/crdt-bridge';
import { spaceState } from '../store/space';

interface AvatarProps {
  participant: Participant;
  onDrag?: (id: string, x: number, y: number) => void;
  onStatusChange?: (status: string) => void;
}

export function Avatar(props: AvatarProps): JSX.Element {
  let videoRef: HTMLVideoElement | undefined;
  const [isDragging, setIsDragging] = createSignal(false);
  const [showStatusEditor, setShowStatusEditor] = createSignal(false);
  
  // Attach video stream when it changes
  createEffect(() => {
    const stream = props.participant.stream;
    if (videoRef && stream) {
      videoRef.srcObject = stream;
    }
  });

  // Handle drag for local avatar
  const handleMouseDown = (e: MouseEvent) => {
    if (!props.participant.isLocal) return;
    e.preventDefault();
    setIsDragging(true);
    
    const startX = e.clientX - props.participant.position.x;
    const startY = e.clientY - props.participant.position.y;
    
    const handleMouseMove = (e: MouseEvent) => {
      const newX = e.clientX - startX;
      const newY = e.clientY - startY;
      props.onDrag?.(props.participant.id, newX, newY);
    };
    
    const handleMouseUp = () => {
      setIsDragging(false);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      
      // Broadcast final position to CRDT
      broadcastPosition(props.participant.position.x, props.participant.position.y);
    };
    
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  // Double-click to edit status (local only)
  const handleDoubleClick = () => {
    if (props.participant.isLocal) {
      setShowStatusEditor(true);
    }
  };

  const avatarClasses = () => {
    const classes = ['avatar'];
    if (props.participant.isLocal) classes.push('local');
    if (props.participant.isSpeaking) classes.push('speaking');
    if (isDragging()) classes.push('dragging');
    return classes.join(' ');
  };

  return (
    <div
      class={avatarClasses()}
      style={{
        transform: `translate(${props.participant.position.x}px, ${props.participant.position.y}px)`,
        cursor: props.participant.isLocal ? 'grab' : 'default',
      }}
      onMouseDown={handleMouseDown}
      onDblClick={handleDoubleClick}
    >
      {/* Video container */}
      <div class="avatar-video-container">
        <Show
          when={!props.participant.isVideoOff && props.participant.stream}
          fallback={
            <div class="avatar-placeholder">
              {props.participant.username.charAt(0).toUpperCase()}
            </div>
          }
        >
          <video
            ref={videoRef}
            autoplay
            playsinline
            muted={props.participant.isLocal}
            class="avatar-video"
          />
        </Show>
        
        {/* Muted indicator */}
        <Show when={props.participant.isMuted}>
          <div class="avatar-muted-indicator">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="1" y1="1" x2="23" y2="23" />
              <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6" />
              <path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23" />
              <line x1="12" y1="19" x2="12" y2="23" />
              <line x1="8" y1="23" x2="16" y2="23" />
            </svg>
          </div>
        </Show>
      </div>

      {/* Name label */}
      <div class="avatar-name">
        {props.participant.username}
        {props.participant.isLocal && ' (You)'}
      </div>

      {/* Status badge */}
      <Show when={props.participant.status}>
        <div class="avatar-status">{props.participant.status}</div>
      </Show>

      {/* Status editor popover */}
      <Show when={showStatusEditor()}>
        <StatusEditor
          currentStatus={props.participant.status}
          onSave={(status) => {
            props.onStatusChange?.(status);
            setShowStatusEditor(false);
          }}
          onClose={() => setShowStatusEditor(false)}
        />
      </Show>
    </div>
  );
}

// ==================== Status Editor ====================

interface StatusEditorProps {
  currentStatus: string;
  onSave: (status: string) => void;
  onClose: () => void;
}

function StatusEditor(props: StatusEditorProps): JSX.Element {
  let inputRef: HTMLInputElement | undefined;
  const [status, setStatus] = createSignal(props.currentStatus);

  createEffect(() => {
    inputRef?.focus();
  });

  const handleSubmit = (e: Event) => {
    e.preventDefault();
    props.onSave(status());
  };

  const handleClear = () => {
    props.onSave('');
  };

  return (
    <div class="status-popover" onClick={(e) => e.stopPropagation()}>
      <form onSubmit={handleSubmit}>
        <input
          ref={inputRef}
          type="text"
          value={status()}
          onInput={(e) => setStatus(e.currentTarget.value)}
          placeholder="What's your status?"
          maxLength={30}
        />
        <div class="status-buttons">
          <button type="button" onClick={handleClear}>Clear</button>
          <button type="submit">Save</button>
        </div>
      </form>
    </div>
  );
}

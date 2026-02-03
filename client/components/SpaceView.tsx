/**
 * SpaceView Component
 * The main space view that contains the canvas, controls, and UI elements.
 * Renders DOM structure expected by legacy modules (CanvasManager, AvatarManager, etc.)
 */
import { type JSX, type Accessor } from 'solid-js';
import { ControlBar, type MediaState, type ActivityState } from './ControlBar';
import { SpaceInfo } from './SpaceInfo';
import { ConnectionStatus } from './ConnectionStatus';

interface SpaceViewProps {
  spaceName: Accessor<string>;
  participantCount: Accessor<number>;
  media: Accessor<MediaState>;
  activity: Accessor<ActivityState>;
  onToggleMic: () => void;
  onToggleCamera: () => void;
  onToggleScreen: () => void;
  onAddNote: () => void;
  onToggleActivity: () => void;
  onLeave: () => void;
}

export function SpaceView(props: SpaceViewProps): JSX.Element {
  return (
    <div id="canvas-container">
      {/* Space for avatars and screen shares - legacy modules append elements here */}
      <div id="space">
        {/* AvatarManager, ScreenShareManager, TextNoteManager add elements here */}
      </div>

      {/* Space Info Badge */}
      <SpaceInfo spaceName={props.spaceName} participantCount={props.participantCount} />

      {/* Connection Status Banner - UIController manages content */}
      <ConnectionStatus state={() => 'connected'} />

      {/* Control Bar */}
      <ControlBar
        media={props.media}
        activity={props.activity}
        onToggleMic={props.onToggleMic}
        onToggleCamera={props.onToggleCamera}
        onToggleScreen={props.onToggleScreen}
        onAddNote={props.onAddNote}
        onToggleActivity={props.onToggleActivity}
        onLeave={props.onLeave}
      />
    </div>
  );
}

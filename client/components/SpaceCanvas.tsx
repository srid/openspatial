/**
 * Space canvas component — container for avatars, screen shares, notes
 */

import { Component, For } from 'solid-js';
import { collections, user } from '../stores/app';
import { ControlBar } from './ControlBar';
import { ConnectionStatusBanner } from './ConnectionStatus';

interface SpaceCanvasProps {
  onToggleMic: () => void;
  onToggleCamera: () => void;
  onShareScreen: () => void;
  onAddNote: () => void;
  onLeave: () => void;
}

export const SpaceCanvas: Component<SpaceCanvasProps> = (props) => {
  // Calculate participant count reactively
  const participantCount = () => {
    const peerCount = collections.peers().size;
    // +1 for self if we have a peerId
    return user.peerId() ? peerCount + 1 : peerCount;
  };

  return (
    <div id="canvas-container">
      {/* Space for avatars and screen shares - managed by legacy modules for now */}
      <div id="space">
        {/* Avatars, screen shares, and text notes are rendered here by existing managers */}
        {/* They will be converted to pure TSX components in a future iteration */}
      </div>

      {/* Space Info */}
      <div id="space-info">
        <span id="space-name">{user.spaceId()}</span>
        <span id="participant-count">{participantCount()} participants</span>
      </div>

      {/* Connection Status Banner */}
      <ConnectionStatusBanner />

      {/* Control Bar */}
      <ControlBar
        onToggleMic={props.onToggleMic}
        onToggleCamera={props.onToggleCamera}
        onShareScreen={props.onShareScreen}
        onAddNote={props.onAddNote}
        onLeave={props.onLeave}
      />
    </div>
  );
};

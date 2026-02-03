/**
 * App Component
 * Root component that renders the appropriate view based on route.
 * Pure render from store - no DOM manipulation.
 */
import { Match, Switch, type JSX } from 'solid-js';
import { Landing } from './Landing';
import { JoinModal } from './JoinModal';
import { Canvas } from './Canvas';
import { ControlBar } from './ControlBar';
import { SpaceInfo } from './SpaceInfo';
import { ConnectionStatus } from './ConnectionStatus';

import {
  route, setRoute,
  username, saveUsername,
  joinParticipants, joinError,
  activityStateAccessor,
  toggleActivityPanel,
} from '../store/app';

import {
  spaceState,
  localMedia,
  participantCount,
} from '../store/space';

interface AppProps {
  onJoinSpace: (spaceId: string, username: string) => void;
  onLeaveSpace: () => void;
  onToggleMic: () => void;
  onToggleCamera: () => void;
  onToggleScreen: () => void;
  onAddNote: () => void;
}

export function App(props: AppProps): JSX.Element {
  const handleEnterSpace = (spaceId: string) => {
    setRoute({ type: 'join', spaceId });
    window.history.pushState({}, '', `/s/${spaceId}`);
  };

  const handleJoin = (name: string) => {
    saveUsername(name);
    const currentRoute = route();
    if (currentRoute.type === 'join') {
      props.onJoinSpace(currentRoute.spaceId, name);
    }
  };

  const handleBack = () => {
    setRoute({ type: 'landing' });
    window.history.pushState({}, '', '/');
  };

  const handleLeave = () => {
    props.onLeaveSpace();
  };

  // Media state accessor for ControlBar
  const mediaStateAccessor = () => ({
    isMuted: localMedia.isMuted,
    isVideoOff: localMedia.isVideoOff,
    isScreenSharing: localMedia.isScreenSharing,
  });

  // Space name accessor
  const spaceNameAccessor = () => spaceState.spaceId || 'Space';

  return (
    <Switch>
      {/* Landing Page */}
      <Match when={route().type === 'landing'}>
        <Landing onEnterSpace={handleEnterSpace} />
      </Match>

      {/* Join Modal */}
      <Match when={route().type === 'join'}>
        {(() => {
          const r = route();
          if (r.type !== 'join') return null;
          return (
            <JoinModal
              spaceId={() => r.spaceId}
              participants={joinParticipants}
              error={joinError}
              onJoin={handleJoin}
              onBack={handleBack}
              savedUsername={username()}
            />
          );
        })()}
      </Match>

      {/* Main Space */}
      <Match when={route().type === 'space'}>
        <div id="space-container" class="space-container">
          {/* Space Info (top-left) */}
          <SpaceInfo
            spaceName={spaceNameAccessor}
            participantCount={participantCount}
          />

          {/* Connection Status (top-center) */}
          <ConnectionStatus />

          {/* Main Canvas */}
          <Canvas />

          {/* Control Bar (bottom) */}
          <ControlBar
            media={mediaStateAccessor}
            activity={activityStateAccessor}
            onToggleMic={props.onToggleMic}
            onToggleCamera={props.onToggleCamera}
            onToggleScreen={props.onToggleScreen}
            onAddNote={props.onAddNote}
            onToggleActivity={toggleActivityPanel}
            onLeave={handleLeave}
          />
        </div>
      </Match>
    </Switch>
  );
}

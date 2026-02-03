/**
 * App Component
 * Root component that renders the appropriate view based on route.
 */
import { Show, Match, Switch, type JSX } from 'solid-js';
import { Landing } from './Landing';
import { JoinModal } from './JoinModal';
import { ControlBar } from './ControlBar';
import { SpaceInfo } from './SpaceInfo';
import { ConnectionStatus } from './ConnectionStatus';
import { Canvas } from './Canvas';
import {
  route, setRoute,
  username, saveUsername,
  spaceName,
  participantCount,
  joinParticipants, joinError,
  connectionState, reconnectAttempt,
  mediaStateAccessor, activityStateAccessor,
  toggleMuted, toggleVideoOff, setScreenSharing,
  toggleActivityPanel,
} from '../store/app';

interface AppProps {
  onJoinSpace: (spaceId: string, username: string) => void;
  onLeaveSpace: () => void;
  onToggleScreen: () => void;
  onAddNote: () => void;
}

export function App(props: AppProps): JSX.Element {
  const handleEnterSpace = (spaceId: string) => {
    setRoute({ type: 'join', spaceId });
    // Trigger space info query (handled externally)
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
    setRoute({ type: 'landing' });
    window.history.pushState({}, '', '/');
  };

  const handleToggleMic = () => {
    toggleMuted();
    // External handler will sync with WebRTC
  };

  const handleToggleCamera = () => {
    toggleVideoOff();
    // External handler will sync with WebRTC
  };

  return (
    <>
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
          <div id="canvas-container">
            <Canvas />

            <SpaceInfo
              spaceName={spaceName}
              participantCount={participantCount}
            />

            <ConnectionStatus
              state={connectionState}
              reconnectAttempt={reconnectAttempt}
            />

            <ControlBar
              media={mediaStateAccessor}
              activity={activityStateAccessor}
              onToggleMic={handleToggleMic}
              onToggleCamera={handleToggleCamera}
              onToggleScreen={props.onToggleScreen}
              onAddNote={props.onAddNote}
              onToggleActivity={toggleActivityPanel}
              onLeave={handleLeave}
            />
          </div>
        </Match>
      </Switch>
    </>
  );
}

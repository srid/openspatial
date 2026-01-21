/**
 * Root App component — view router based on AppView state
 */

import { Component, Show } from 'solid-js';
import { ui, AppView } from '../stores/app';
import { LandingPage } from './LandingPage';
import { JoinModal } from './JoinModal';
import { SpaceCanvas } from './SpaceCanvas';
import type { ModuleBridge } from '../types/bridge';

interface AppProps {
  bridge: ModuleBridge;
}

export const App: Component<AppProps> = (props) => {
  return (
    <>
      <Show when={ui.currentView() === AppView.Landing}>
        <LandingPage onEnterSpace={props.bridge.handleEnterSpace} />
      </Show>

      <Show when={ui.currentView() === AppView.Join}>
        <JoinModal onJoin={props.bridge.handleJoin} />
      </Show>

      <Show when={ui.currentView() === AppView.Space}>
        <SpaceCanvas
          onToggleMic={props.bridge.toggleMic}
          onToggleCamera={props.bridge.toggleCamera}
          onShareScreen={props.bridge.shareScreen}
          onAddNote={props.bridge.addNote}
          onLeave={props.bridge.leaveSpace}
        />
      </Show>
    </>
  );
};

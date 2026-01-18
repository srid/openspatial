/**
 * App.tsx - Root Solid.js component for OpenSpatial
 * 
 * Architecture: This component handles the UI layer while delegating
 * to existing modules for business logic (WebRTC, CRDT, Socket, etc.)
 */
import { Component, Show, onMount, createEffect } from 'solid-js';
import { LandingPage } from './components/LandingPage';
import { JoinModal } from './components/JoinModal';
import { ControlBar } from './components/ControlBar';
import { ConnectionStatus } from './components/ConnectionStatus';
import { 
  ui, 
  user, 
  media, 
  connection,
  peersStore,
  participantCount,
  AppView 
} from './stores/app';

// Bridge to existing modules - will be set from main.tsx
interface ModuleBridge {
  handleEnterSpace: (spaceName: string) => void;
  handleJoin: (username: string) => void;
  handleBack: () => void;
  toggleMic: () => void;
  toggleCamera: () => void;
  startScreenShare: () => void;
  createTextNote: () => void;
  leaveSpace: () => void;
  querySpaceInfo: (spaceId: string) => void;
}

let bridge: ModuleBridge | null = null;

export function setModuleBridge(b: ModuleBridge) {
  bridge = b;
}

export const App: Component = () => {
  // Handle route on mount
  onMount(() => {
    const pathMatch = window.location.pathname.match(/^\/s\/(.+)$/);
    if (pathMatch) {
      const spaceId = decodeURIComponent(pathMatch[1]);
      user.setSpaceId(spaceId);
      document.title = `${spaceId} - OpenSpatial`;
      ui.setCurrentView(AppView.Join);
      ui.setIsLoadingParticipants(true);
      bridge?.querySpaceInfo(spaceId);
    } else {
      ui.setCurrentView(AppView.Landing);
    }
  });

  const handleEnterSpace = (spaceName: string) => {
    window.location.href = `/s/${encodeURIComponent(spaceName)}`;
  };

  const handleJoin = (username: string) => {
    bridge?.handleJoin(username);
  };

  const handleBack = () => {
    window.location.href = '/';
  };

  return (
    <>
      {/* Landing Page */}
      <Show when={ui.currentView() === AppView.Landing}>
        <LandingPage onEnterSpace={handleEnterSpace} />
      </Show>

      {/* Join Modal */}
      <Show when={ui.currentView() === AppView.Join}>
        <JoinModal
          spaceId={user.spaceId()}
          participants={ui.spaceParticipants()}
          isLoadingParticipants={ui.isLoadingParticipants()}
          error={ui.joinError()}
          savedUsername={localStorage.getItem('openspatial-username') ?? ''}
          onJoin={handleJoin}
          onBack={handleBack}
        />
      </Show>

      {/* Space View */}
      <Show when={ui.currentView() === AppView.Space}>
        {/* Canvas Container - managed by CanvasManager module */}
        <div id="canvas-container">
          <div id="space">
            {/* Avatars and screen shares rendered by existing modules */}
          </div>

          {/* Space Info */}
          <div id="space-info" class="fixed top-4 left-4 flex items-center gap-4 py-3 px-5 bg-slate-900/80 border border-white/10 rounded-full backdrop-blur-xl z-[100]">
            <span id="space-name" class="font-semibold text-white">{user.spaceId()}</span>
            <span id="participant-count" class="text-sm text-white/40">{participantCount()} participants</span>
          </div>

          {/* Connection Status */}
          <ConnectionStatus
            status={connection.status()}
            reconnectAttempt={connection.reconnectAttempt()}
            reconnectMaxAttempts={connection.reconnectMaxAttempts()}
          />

          {/* Control Bar */}
          <ControlBar
            isMuted={media.isMuted()}
            isVideoOff={media.isVideoOff()}
            isScreenSharing={media.isScreenSharing()}
            onToggleMic={() => bridge?.toggleMic()}
            onToggleCamera={() => bridge?.toggleCamera()}
            onToggleScreenShare={() => bridge?.startScreenShare()}
            onCreateNote={() => bridge?.createTextNote()}
            onLeave={() => bridge?.leaveSpace()}
          />
        </div>
      </Show>
    </>
  );
};

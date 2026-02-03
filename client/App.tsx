/**
 * App Root Component
 * Orchestrates space session lifecycle with SolidJS reactive primitives.
 */
import { Component, Show, createSignal, onMount, onCleanup } from 'solid-js';
import { SpaceProvider, useSpace } from './context/SpaceContext';
import { Landing } from './components/Landing';
import { JoinModal } from './components/JoinModal';
import { Canvas } from './components/Canvas/Canvas';
import { ControlBar } from './components/Controls/ControlBar';
import { ConnectionStatus } from './components/ConnectionStatus';

const AppContent: Component = () => {
  const { session, view } = useSpace();
  
  return (
    <>
      <Show when={view() === 'landing'}>
        <Landing />
      </Show>
      
      <Show when={view() === 'join'}>
        <JoinModal />
      </Show>
      
      <Show when={view() === 'space'}>
        <Canvas />
        <ControlBar />
        <ConnectionStatus />
      </Show>
    </>
  );
};

export const App: Component = () => {
  return (
    <SpaceProvider>
      <AppContent />
    </SpaceProvider>
  );
};

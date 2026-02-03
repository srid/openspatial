/**
 * ConnectionStatus Component
 * Shows connection/reconnection status banner.
 */
import { Component, Show, createEffect, createSignal } from 'solid-js';
import { useSpace } from '@/context/SpaceContext';

export const ConnectionStatus: Component = () => {
  const { connectionState } = useSpace();
  
  const [visible, setVisible] = createSignal(false);
  
  createEffect(() => {
    const state = connectionState();
    if (state === 'disconnected' || state === 'reconnecting') {
      setVisible(true);
    } else if (state === 'connected') {
      // Show connected briefly then hide
      setVisible(true);
      setTimeout(() => setVisible(false), 2000);
    }
  });
  
  return (
    <Show when={visible()}>
      <div
        id="connection-status"
        class="connection-status"
        classList={{
          'disconnected': connectionState() === 'disconnected',
          'reconnecting': connectionState() === 'reconnecting',
          'connected': connectionState() === 'connected',
        }}
      >
        <Show when={connectionState() === 'disconnected'}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="1" y1="1" x2="23" y2="23" />
            <path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55" />
            <path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39" />
            <path d="M10.71 5.05A16 16 0 0 1 22.58 9" />
            <path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88" />
            <path d="M8.53 16.11a6 6 0 0 1 6.95 0" />
            <line x1="12" y1="20" x2="12.01" y2="20" />
          </svg>
          <span>Connection lost. Waiting to reconnect...</span>
        </Show>
        
        <Show when={connectionState() === 'reconnecting'}>
          <svg class="spin" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 12a9 9 0 1 1-6.219-8.56" />
          </svg>
          <span>Reconnecting...</span>
        </Show>
        
        <Show when={connectionState() === 'connected'}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M5 12.55a11 11 0 0 1 14.08 0" />
            <path d="M1.42 9a16 16 0 0 1 21.16 0" />
            <path d="M8.53 16.11a6 6 0 0 1 6.95 0" />
            <line x1="12" y1="20" x2="12.01" y2="20" />
          </svg>
          <span>Connected</span>
        </Show>
      </div>
    </Show>
  );
};

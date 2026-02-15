/**
 * ConnectionStatus Component
 * Shows connection/reconnection status banner.
 * Element always exists for e2e tests but hidden when connected.
 */
import { Component, Show, createEffect, createSignal } from 'solid-js';
import { useSpace } from '@/context/SpaceContext';

export const ConnectionStatus: Component = () => {
  const ctx = useSpace();
  
  const [visible, setVisible] = createSignal(false);
  
  createEffect(() => {
    const state = ctx.connectionState();
    if (state === 'disconnected' || state === 'reconnecting') {
      setVisible(true);
    } else if (state === 'connected') {
      setVisible(true);
      // Show briefly then hide
      setTimeout(() => setVisible(false), 2000);
    }
  });
  
  const baseClasses = 'fixed top-4 left-1/2 -translate-x-1/2 flex items-center gap-3 py-3 px-5 rounded-full backdrop-blur-[12px] text-sm font-medium z-[200] transition-all duration-(--transition-base)';
  
  const stateClasses = () => {
    const state = ctx.connectionState();
    if (state === 'disconnected') return 'bg-[rgba(239,68,68,0.9)] border border-danger text-white shadow-[0_0_20px_rgba(239,68,68,0.4)] animate-pulse-conn';
    if (state === 'reconnecting') return 'bg-[rgba(245,158,11,0.9)] border border-warning text-white shadow-[0_0_20px_rgba(245,158,11,0.4)]';
    if (state === 'connected') return 'bg-[rgba(34,197,94,0.3)] border border-[rgba(34,197,94,0.5)] text-success p-2 opacity-70 justify-center gap-0 group hover:bg-[rgba(34,197,94,0.9)] hover:text-white hover:py-3 hover:px-5 hover:opacity-100 hover:shadow-[0_0_20px_rgba(34,197,94,0.4)]';
    return '';
  };
  
  // Element always exists for e2e, visibility controlled by class
  return (
    <div
      id="connection-status"
      class={`${baseClasses} ${stateClasses()}`}
      classList={{
        'hidden': !visible(),
        'disconnected': ctx.connectionState() === 'disconnected',
      }}
    >
      <Show when={ctx.connectionState() === 'disconnected'}>
        <svg class="shrink-0" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
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
      
      <Show when={ctx.connectionState() === 'reconnecting'}>
        <svg class="shrink-0 animate-spin-slow" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M21 12a9 9 0 1 1-6.219-8.56" />
        </svg>
        <span>Reconnecting...</span>
      </Show>
      
      <Show when={ctx.connectionState() === 'connected'}>
        <svg class="shrink-0" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M5 12.55a11 11 0 0 1 14.08 0" />
          <path d="M1.42 9a16 16 0 0 1 21.16 0" />
          <path d="M8.53 16.11a6 6 0 0 1 6.95 0" />
          <line x1="12" y1="20" x2="12.01" y2="20" />
        </svg>
        <span class="max-w-0 overflow-hidden whitespace-nowrap transition-all duration-(--transition-base) ml-0 group-hover:max-w-[100px] group-hover:ml-2">Connected</span>
      </Show>
    </div>
  );
};

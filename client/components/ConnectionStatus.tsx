/**
 * ConnectionStatus Component - Shows connection state banner
 */
import { Component, Show } from 'solid-js';
import { WifiIcon, WifiOffIcon, SpinnerIcon } from './Icons';
import type { ConnectionStatus as ConnectionStatusType } from '../stores/app';

interface ConnectionStatusProps {
  status: ConnectionStatusType;
  reconnectAttempt?: number;
  reconnectMaxAttempts?: number;
}

export const ConnectionStatus: Component<ConnectionStatusProps> = (props) => {
  const baseClasses = "fixed top-4 left-1/2 -translate-x-1/2 flex items-center gap-3 rounded-full backdrop-blur-xl text-sm font-medium z-[200] transition-all duration-200";

  return (
    <Show when={props.status !== 'connected' || true}>
      <div
        id="connection-status"
        class={`${baseClasses} ${
          props.status === 'disconnected'
            ? 'px-5 py-3 bg-red-500/90 border border-red-500 text-white shadow-[0_0_20px_rgba(239,68,68,0.4)] animate-pulse'
            : props.status === 'reconnecting'
            ? 'px-5 py-3 bg-amber-500/90 border border-amber-500 text-white shadow-[0_0_20px_rgba(245,158,11,0.4)]'
            : 'p-2 bg-green-500/30 border border-green-500/50 text-green-500 opacity-70 hover:opacity-100 hover:bg-green-500/90 hover:text-white hover:px-5 hover:py-3 hover:shadow-[0_0_20px_rgba(34,197,94,0.4)]'
        }`}
      >
        <Show when={props.status === 'disconnected'}>
          <WifiOffIcon />
          <span>Disconnected</span>
        </Show>
        <Show when={props.status === 'reconnecting'}>
          <SpinnerIcon />
          <span>Reconnecting... ({props.reconnectAttempt}/{props.reconnectMaxAttempts})</span>
        </Show>
        <Show when={props.status === 'connected'}>
          <WifiIcon />
          <span class="max-w-0 overflow-hidden whitespace-nowrap transition-all duration-200 group-hover:max-w-[100px] group-hover:ml-2">
            Connected
          </span>
        </Show>
      </div>
    </Show>
  );
};

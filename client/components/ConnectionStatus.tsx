/**
 * ConnectionStatus Component
 * Top-center banner showing connection state.
 * Reads directly from store for connection state.
 */
import { Show, type JSX } from 'solid-js';
import { spaceState } from '../store/space';

export function ConnectionStatus(): JSX.Element {
  return (
    <Show when={spaceState.isConnected}>
      <div id="connection-status" class="connection-status">
        <div class="connection-indicator connected" />
      </div>
    </Show>
  );
}

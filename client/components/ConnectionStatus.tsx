/**
 * ConnectionStatus Component
 * Top-center banner showing connection state.
 * Renders the exact DOM structure expected by UIController.
 */
import type { JSX, Accessor } from 'solid-js';

export type ConnectionState = 'connected' | 'disconnected' | 'reconnecting';

interface ConnectionStatusProps {
  state: Accessor<ConnectionState>;
  reconnectAttempt?: Accessor<number>;
  maxAttempts?: number;
}

export function ConnectionStatus(props: ConnectionStatusProps): JSX.Element {
  // UIController manipulates this element directly, so we just render the container
  return (
    <div
      id="connection-status"
      class="connection-status hidden"
    />
  );
}

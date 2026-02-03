/**
 * ConnectionStatus Component
 * Top-center banner showing connection state.
 */
import { Show, type JSX, type Accessor } from 'solid-js';
import { SpinnerIcon, CheckIcon, XIcon } from './Icons';

export type ConnectionState = 'connected' | 'disconnected' | 'reconnecting';

interface ConnectionStatusProps {
  state: Accessor<ConnectionState>;
  reconnectAttempt?: Accessor<number>;
}

export function ConnectionStatus(props: ConnectionStatusProps): JSX.Element {
  return (
    <Show when={props.state() !== 'connected' || true}>
      <div
        id="connection-status"
        class="connection-status"
        classList={{
          connected: props.state() === 'connected',
          disconnected: props.state() === 'disconnected',
          reconnecting: props.state() === 'reconnecting',
        }}
      >
        <Show when={props.state() === 'connected'}>
          <CheckIcon size={16} />
          <span>Connected</span>
        </Show>
        <Show when={props.state() === 'disconnected'}>
          <XIcon size={16} />
          <span>Disconnected</span>
        </Show>
        <Show when={props.state() === 'reconnecting'}>
          <SpinnerIcon size={16} />
          <span>Reconnecting{props.reconnectAttempt ? ` (${props.reconnectAttempt()})` : ''}...</span>
        </Show>
      </div>
    </Show>
  );
}

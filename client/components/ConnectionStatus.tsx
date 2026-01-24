/**
 * Connection status banner — shows reconnecting state
 */

import { Component } from 'solid-js';
import { connection, ConnectionStatus } from '../stores/app';

export const ConnectionStatusBanner: Component = () => {
  const getMessage = () => {
    const status = connection.status();
    if (status === ConnectionStatus.Reconnecting) {
      return `Reconnecting... (${connection.reconnectAttempt()}/${connection.reconnectMax()})`;
    }
    if (status === ConnectionStatus.Disconnected) {
      return 'Disconnected';
    }
    return '';
  };

  return (
    // Always render so E2E tests can find the element
    <div
      id="connection-status"
      class="connection-status"
      classList={{
        hidden: connection.status() === ConnectionStatus.Connected,
        reconnecting: connection.status() === ConnectionStatus.Reconnecting,
        disconnected: connection.status() === ConnectionStatus.Disconnected,
      }}
    >
      {getMessage()}
    </div>
  );
};

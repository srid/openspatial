import { io, Socket } from 'socket.io-client';
import type {
  JoinSpaceEvent,
  SignalEvent,
  ScreenShareStartedEvent,
  ScreenShareStoppedEvent,
  GetSpaceInfoEvent,
  SpaceInfoEvent,
  ConnectedEvent,
  SpaceStateEvent,
  PeerJoinedEvent,
  PeerLeftEvent,
  ScreenShareStartedBroadcast,
  ScreenShareStoppedBroadcast,
} from '../../shared/types/events.js';

// NOTE: PositionUpdateEvent, MediaStateUpdateEvent, StatusUpdateEvent,
// ScreenSharePositionUpdateEvent, ScreenShareResizeUpdateEvent have been
// removed. These state updates are now handled by Yjs CRDT, not Socket.io.

/** Events that the client can emit to the server. */
type ClientEventMap = {
  'join-space': JoinSpaceEvent;
  'signal': SignalEvent;
  'screen-share-started': ScreenShareStartedEvent;
  'screen-share-stopped': ScreenShareStoppedEvent;
  'get-space-info': GetSpaceInfoEvent;
};

/** Events that the server can emit to the client. */
type ServerEventMap = {
  'connected': ConnectedEvent;
  'space-state': SpaceStateEvent;
  'space-info': SpaceInfoEvent;
  'peer-joined': PeerJoinedEvent;
  'peer-left': PeerLeftEvent;
  'signal': SignalEvent;
  'screen-share-started': ScreenShareStartedBroadcast;
  'screen-share-stopped': ScreenShareStoppedBroadcast;
};

type EventHandler<T> = (data: T) => void;
type AnyHandler = EventHandler<unknown>;

/** Connection state for UI feedback. */
export type ConnectionState = 'connecting' | 'connected' | 'disconnected' | 'reconnecting';

/** Information about reconnection attempts. */
export interface ReconnectInfo {
  attempt: number;
  maxAttempts: number;
}

/** Callback for connection state changes. */
export type ConnectionStateCallback = (state: ConnectionState, info?: ReconnectInfo) => void;

/**
 * SocketHandler manages the Socket.io connection to the signaling server.
 * 
 * Handles:
 * - Connection lifecycle (connect, disconnect, reconnection)
 * - WebRTC signaling relay
 * - Space join/leave events
 * - Screen share start/stop notifications
 * 
 * Note: Position, media state, and status updates are handled by CRDT, not Socket.io.
 */
export class SocketHandler {
  private static instanceCounter = 0;
  private instanceId: number;
  private socket: Socket | null = null;
  private handlers = new Map<string, AnyHandler[]>();
  private connectionStateCallback: ConnectionStateCallback | null = null;

  private static readonly RECONNECTION_ATTEMPTS = 5;
  private static readonly RECONNECTION_DELAY = 1000;
  private static readonly RECONNECTION_DELAY_MAX = 10000;

  constructor() {
    this.instanceId = ++SocketHandler.instanceCounter;
    console.log(`[Socket] Created SocketHandler instance #${this.instanceId}`);
  }

  onConnectionStateChange(callback: ConnectionStateCallback): void {
    this.connectionStateCallback = callback;
  }

  private notifyConnectionState(state: ConnectionState, info?: ReconnectInfo): void {
    if (this.connectionStateCallback) {
      this.connectionStateCallback(state, info);
    }
  }

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.notifyConnectionState('connecting');

      this.socket = io(window.location.origin, {
        transports: ['websocket'],
        upgrade: false,
        reconnection: true,
        reconnectionAttempts: SocketHandler.RECONNECTION_ATTEMPTS,
        reconnectionDelay: SocketHandler.RECONNECTION_DELAY,
        reconnectionDelayMax: SocketHandler.RECONNECTION_DELAY_MAX,
        forceNew: true,
      });

      this.socket.on('connect', () => {
        console.log(`[Socket#${this.instanceId}] Connected to signaling server`);
        this.notifyConnectionState('connected');
        resolve();
        console.log(`[Socket#${this.instanceId}] resolve() called for connect()`);
      });

      this.socket.on('connect_error', (error: Error) => {
        console.error('Connection error:', error);
        reject(error);
      });

      // Connection state events
      this.socket.on('disconnect', (reason: string) => {
        console.log('Disconnected from signaling server:', reason);
        this.notifyConnectionState('disconnected');
      });

      this.socket.io.on('reconnect_attempt', (attempt: number) => {
        console.log(`Reconnection attempt ${attempt}/${SocketHandler.RECONNECTION_ATTEMPTS}`);
        this.notifyConnectionState('reconnecting', {
          attempt,
          maxAttempts: SocketHandler.RECONNECTION_ATTEMPTS,
        });
      });

      this.socket.io.on('reconnect', () => {
        console.log('Reconnected to signaling server');
        this.notifyConnectionState('connected');
        this.trigger('reconnected', undefined);
      });

      this.socket.io.on('reconnect_failed', () => {
        console.error('Failed to reconnect after maximum attempts');
        this.notifyConnectionState('disconnected');
      });

      // Setup event handlers for server events
      this.socket.on('connected', (data: ConnectedEvent) => {
        console.log('[Socket] Received "connected" event from server:', data);
        this.trigger('connected', data);
      });
      this.socket.on('space-state', (data: SpaceStateEvent) => this.trigger('space-state', data));
      this.socket.on('peer-joined', (data: PeerJoinedEvent) => this.trigger('peer-joined', data));
      this.socket.on('peer-left', (data: PeerLeftEvent) => this.trigger('peer-left', data));
      this.socket.on('signal', (data: SignalEvent) => this.trigger('signal', data));
      // NOTE: position-update, media-state-update, status-update, screen-share-position-update,
      // screen-share-resize-update have been removed. These are now handled by Yjs CRDT observers.
      this.socket.on('screen-share-started', (data: ScreenShareStartedBroadcast) => this.trigger('screen-share-started', data));
      this.socket.on('screen-share-stopped', (data: ScreenShareStoppedBroadcast) => this.trigger('screen-share-stopped', data));
      this.socket.on('space-info', (data: SpaceInfoEvent) => this.trigger('space-info', data));
    });
  }

  on<K extends keyof ServerEventMap>(event: K, handler: EventHandler<ServerEventMap[K]>): void;
  on(event: 'reconnected', handler: () => void): void;
  on(event: string, handler: AnyHandler): void {
    if (!this.handlers.has(event)) {
      this.handlers.set(event, []);
    }
    this.handlers.get(event)!.push(handler);
  }

  off<K extends keyof ServerEventMap>(event: K, handler: EventHandler<ServerEventMap[K]>): void {
    if (this.handlers.has(event)) {
      const handlers = this.handlers.get(event)!;
      const index = handlers.indexOf(handler as AnyHandler);
      if (index > -1) {
        handlers.splice(index, 1);
      }
    }
  }

  private trigger(event: string, data: unknown): void {
    console.log(`[Socket] Triggering event: ${event}`, this.handlers.has(event) ? `(${this.handlers.get(event)!.length} handlers)` : '(no handlers)');
    if (this.handlers.has(event)) {
      this.handlers.get(event)!.forEach((handler) => handler(data));
    }
  }

  emit<K extends keyof ClientEventMap>(event: K, data: ClientEventMap[K]): void {
    if (this.socket) {
      this.socket.emit(event, data);
    }
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }
}

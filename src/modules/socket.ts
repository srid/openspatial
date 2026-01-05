import { io, Socket } from 'socket.io-client';
import type {
  JoinSpaceEvent,
  SignalEvent,
  PositionUpdateEvent,
  MediaStateUpdateEvent,
  ScreenShareStartedEvent,
  ScreenShareStoppedEvent,
  ScreenSharePositionUpdateEvent,
  ConnectedEvent,
  SpaceStateEvent,
  PeerJoinedEvent,
  PeerLeftEvent,
  ScreenShareStartedBroadcast,
  ScreenShareStoppedBroadcast,
} from '../types/events.js';

// Union type of all possible client events
type ClientEventMap = {
  'join-space': JoinSpaceEvent;
  'signal': SignalEvent;
  'position-update': PositionUpdateEvent;
  'media-state-update': MediaStateUpdateEvent;
  'screen-share-started': ScreenShareStartedEvent;
  'screen-share-stopped': ScreenShareStoppedEvent;
  'screen-share-position-update': ScreenSharePositionUpdateEvent;
};

// Union type of all possible server events
type ServerEventMap = {
  'connected': ConnectedEvent;
  'space-state': SpaceStateEvent;
  'peer-joined': PeerJoinedEvent;
  'peer-left': PeerLeftEvent;
  'signal': SignalEvent;
  'position-update': PositionUpdateEvent;
  'media-state-update': MediaStateUpdateEvent;
  'screen-share-started': ScreenShareStartedBroadcast;
  'screen-share-stopped': ScreenShareStoppedBroadcast;
  'screen-share-position-update': ScreenSharePositionUpdateEvent;
};

type EventHandler<T> = (data: T) => void;
type AnyHandler = EventHandler<unknown>;

export class SocketHandler {
  private socket: Socket | null = null;
  private handlers = new Map<string, AnyHandler[]>();

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.socket = io(window.location.origin, {
        transports: ['websocket'],
        upgrade: false,
        reconnection: false,
        forceNew: true,
      });

      this.socket.on('connect', () => {
        console.log('Connected to signaling server');
        resolve();
      });

      this.socket.on('connect_error', (error: Error) => {
        console.error('Connection error:', error);
        reject(error);
      });

      // Setup event handlers for server events
      this.socket.on('connected', (data: ConnectedEvent) => this.trigger('connected', data));
      this.socket.on('space-state', (data: SpaceStateEvent) => this.trigger('space-state', data));
      this.socket.on('peer-joined', (data: PeerJoinedEvent) => this.trigger('peer-joined', data));
      this.socket.on('peer-left', (data: PeerLeftEvent) => this.trigger('peer-left', data));
      this.socket.on('signal', (data: SignalEvent) => this.trigger('signal', data));
      this.socket.on('position-update', (data: PositionUpdateEvent) => this.trigger('position-update', data));
      this.socket.on('media-state-update', (data: MediaStateUpdateEvent) => this.trigger('media-state-update', data));
      this.socket.on('screen-share-started', (data: ScreenShareStartedBroadcast) => this.trigger('screen-share-started', data));
      this.socket.on('screen-share-stopped', (data: ScreenShareStoppedBroadcast) => this.trigger('screen-share-stopped', data));
      this.socket.on('screen-share-position-update', (data: ScreenSharePositionUpdateEvent) => this.trigger('screen-share-position-update', data));
    });
  }

  on<K extends keyof ServerEventMap>(event: K, handler: EventHandler<ServerEventMap[K]>): void {
    if (!this.handlers.has(event)) {
      this.handlers.set(event, []);
    }
    this.handlers.get(event)!.push(handler as AnyHandler);
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

  private trigger<K extends keyof ServerEventMap>(event: K, data: ServerEventMap[K]): void {
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

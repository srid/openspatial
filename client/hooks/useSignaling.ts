/**
 * useSignaling - Socket.io signaling hook for WebRTC
 */
import { onCleanup } from 'solid-js';
import { io, Socket } from 'socket.io-client';
import { useSpace } from '@/context/SpaceContext';
import type { ConnectionState } from '@/context/SpaceContext';
import type {
  ConnectedEvent,
  SpaceStateEvent,
  SpaceInfoEvent,
  PeerJoinedEvent,
  PeerLeftEvent,
  SignalEvent,
  ScreenShareStartedBroadcast,
  ScreenShareStoppedBroadcast,
  SpaceActivityEvent,
} from '../../shared/types/events';

type EventHandler<T> = (data: T) => void;
type AnyHandler = EventHandler<unknown>;

export interface SignalingHook {
  connect: () => Promise<void>;
  disconnect: () => void;
  emit: <K extends keyof ClientEventMap>(event: K, data: ClientEventMap[K]) => void;
  on: <K extends keyof ServerEventMap>(event: K, handler: EventHandler<ServerEventMap[K]>) => void;
  once: <K extends keyof ServerEventMap>(event: K, handler: EventHandler<ServerEventMap[K]>) => void;
  off: <K extends keyof ServerEventMap>(event: K, handler: EventHandler<ServerEventMap[K]>) => void;
}

type ClientEventMap = {
  'join-space': { spaceId: string; username: string };
  'signal': SignalEvent;
  'screen-share-started': { shareId: string };
  'screen-share-stopped': { shareId: string };
  'get-space-info': { spaceId: string };
};

type ServerEventMap = {
  'connected': ConnectedEvent;
  'space-state': SpaceStateEvent;
  'space-info': SpaceInfoEvent;
  'space-activity': SpaceActivityEvent;
  'peer-joined': PeerJoinedEvent;
  'peer-left': PeerLeftEvent;
  'signal': SignalEvent;
  'screen-share-started': ScreenShareStartedBroadcast;
  'screen-share-stopped': ScreenShareStoppedBroadcast;
};

const RECONNECTION_ATTEMPTS = 5;
const RECONNECTION_DELAY = 1000;
const RECONNECTION_DELAY_MAX = 10000;

export function useSignaling(): SignalingHook {
  const { setConnectionState } = useSpace();
  
  let socket: Socket | null = null;
  const handlers = new Map<string, AnyHandler[]>();
  const onceHandlers = new Map<string, AnyHandler[]>();
  
  function connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      setConnectionState('connecting');
      
      socket = io(window.location.origin, {
        transports: ['websocket'],
        upgrade: false,
        reconnection: true,
        reconnectionAttempts: RECONNECTION_ATTEMPTS,
        reconnectionDelay: RECONNECTION_DELAY,
        reconnectionDelayMax: RECONNECTION_DELAY_MAX,
        forceNew: true,
      });
      
      socket.on('connect', () => {
        console.log('Connected to signaling server');
        setConnectionState('connected');
        resolve();
      });
      
      socket.on('connect_error', (error: Error) => {
        console.error('Connection error:', error);
        reject(error);
      });
      
      socket.on('disconnect', (reason: string) => {
        console.log('Disconnected from signaling server:', reason);
        setConnectionState('disconnected');
      });
      
      socket.io.on('reconnect_attempt', (attempt: number) => {
        console.log(`Reconnection attempt ${attempt}/${RECONNECTION_ATTEMPTS}`);
        setConnectionState('reconnecting');
      });
      
      socket.io.on('reconnect', () => {
        console.log('Reconnected to signaling server');
        setConnectionState('connected');
        trigger('reconnected', undefined);
      });
      
      socket.io.on('reconnect_failed', () => {
        console.error('Failed to reconnect after maximum attempts');
        setConnectionState('disconnected');
      });
      
      // Setup event handlers
      socket.on('connected', (data: ConnectedEvent) => trigger('connected', data));
      socket.on('space-state', (data: SpaceStateEvent) => trigger('space-state', data));
      socket.on('peer-joined', (data: PeerJoinedEvent) => trigger('peer-joined', data));
      socket.on('peer-left', (data: PeerLeftEvent) => trigger('peer-left', data));
      socket.on('signal', (data: SignalEvent) => trigger('signal', data));
      socket.on('screen-share-started', (data: ScreenShareStartedBroadcast) => trigger('screen-share-started', data));
      socket.on('screen-share-stopped', (data: ScreenShareStoppedBroadcast) => trigger('screen-share-stopped', data));
      socket.on('space-info', (data: SpaceInfoEvent) => trigger('space-info', data));
      socket.on('space-activity', (data: SpaceActivityEvent) => trigger('space-activity', data));
    });
  }
  
  function disconnect() {
    socket?.disconnect();
    socket = null;
    handlers.clear();
    onceHandlers.clear();
  }
  
  function on<K extends keyof ServerEventMap>(event: K, handler: EventHandler<ServerEventMap[K]>) {
    if (!handlers.has(event)) {
      handlers.set(event, []);
    }
    handlers.get(event)!.push(handler as AnyHandler);
  }
  
  function once<K extends keyof ServerEventMap>(event: K, handler: EventHandler<ServerEventMap[K]>) {
    if (!onceHandlers.has(event)) {
      onceHandlers.set(event, []);
    }
    onceHandlers.get(event)!.push(handler as AnyHandler);
  }
  
  function off<K extends keyof ServerEventMap>(event: K, handler: EventHandler<ServerEventMap[K]>) {
    const eventHandlers = handlers.get(event);
    if (eventHandlers) {
      const index = eventHandlers.indexOf(handler as AnyHandler);
      if (index > -1) {
        eventHandlers.splice(index, 1);
      }
    }
  }
  
  function trigger(event: string, data: unknown) {
    // Call regular handlers
    handlers.get(event)?.forEach((handler) => handler(data));
    
    // Call and remove once handlers
    const onceHdlrs = onceHandlers.get(event);
    if (onceHdlrs) {
      onceHdlrs.forEach((handler) => handler(data));
      onceHandlers.delete(event);
    }
  }
  
  function emit<K extends keyof ClientEventMap>(event: K, data: ClientEventMap[K]) {
    socket?.emit(event, data);
  }
  
  onCleanup(() => disconnect());
  
  return {
    connect,
    disconnect,
    emit,
    on,
    once,
    off,
  };
}

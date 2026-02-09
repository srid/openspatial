/**
 * ActivityPanel Component
 * Displays recent space activity (join/leave events).
 */
import { Component, For, Show, createSignal, onMount, onCleanup, createEffect } from 'solid-js';
import { useSpace } from '@/context/SpaceContext';
import type { SpaceActivityItem } from '../../../shared/types/events';

interface ActivityPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ActivityPanel: Component<ActivityPanelProps> = (props) => {
  const ctx = useSpace();
  
  const [activities, setActivities] = createSignal<SpaceActivityItem[]>([]);
  
  // Tick signal to force re-computation of relative timestamps
  const [tick, setTick] = createSignal(0);
  
  let refreshInterval: number | null = null;
  
  onMount(() => {
    // Listen for activity updates
    ctx.onSocket<{ events: SpaceActivityItem[] }>('space-activity', (data) => {
      setActivities(data.events.slice(0, 10));
    });
  });
  
  // Refresh timestamps when panel is open by incrementing tick
  createEffect(() => {
    if (props.isOpen) {
      refreshInterval = window.setInterval(() => {
        // Increment tick to force re-computation of formatTimeAgo
        setTick(t => t + 1);
      }, 10000); // Refresh every 10s for responsive time updates
    } else if (refreshInterval) {
      clearInterval(refreshInterval);
      refreshInterval = null;
    }
  });
  
  onCleanup(() => {
    if (refreshInterval) {
      clearInterval(refreshInterval);
    }
  });
  
  function formatTimeAgo(dateStr: string): string {
    // Access tick() to create reactive dependency - forces recalculation
    tick();
    const date = parseUTCDate(dateStr);
    const now = Date.now();
    const diff = now - date.getTime();
    
    const seconds = Math.floor(diff / 1000);
    if (seconds < 60) return 'just now';
    
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  }
  
  function parseUTCDate(dateStr: string): Date {
    const normalized = dateStr.includes('Z') || dateStr.includes('+') 
      ? dateStr 
      : dateStr.replace(' ', 'T') + 'Z';
    return new Date(normalized);
  }
  
  function formatFullTime(dateStr: string): string {
    const date = parseUTCDate(dateStr);
    return date.toLocaleString(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  }
  
  function getEventIcon(eventType: string): string {
    switch (eventType) {
      case 'join_first':
        return '🟢';
      case 'join':
        return '↗';
      case 'leave':
        return '↙';
      case 'leave_last':
        return '⚫';
      default:
        return '•';
    }
  }
  
  function getEventAction(eventType: string): string {
    switch (eventType) {
      case 'join_first':
        return 'opened the space';
      case 'join':
        return 'joined';
      case 'leave':
        return 'left';
      case 'leave_last':
        return 'closed the space';
      default:
        return eventType;
    }
  }
  
  function getIconClass(eventType: string): string {
    if (eventType.startsWith('join')) return 'activity-icon-join';
    if (eventType.startsWith('leave')) return 'activity-icon-leave';
    return '';
  }
  
  function handlePanelClick(e: MouseEvent) {
    e.stopPropagation();
  }
  
  function handleWheel(e: WheelEvent) {
    e.stopPropagation();
  }
  
  return (
    <div
      id="activity-panel"
      class="activity-panel"
      classList={{ 'hidden': !props.isOpen }}
      onClick={handlePanelClick}
      onWheel={handleWheel}
    >
      <div class="activity-header">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10" />
          <polyline points="12 6 12 12 16 14" />
        </svg>
        <span>Recent Activity</span>
      </div>
      <div class="activity-list">
        <Show when={activities().length === 0}>
          <span class="activity-empty">No recent activity</span>
        </Show>
        <For each={activities()}>
          {(event) => (
            <div class={`activity-item activity-${event.event_type}`}>
              <span class={`activity-icon ${getIconClass(event.event_type)}`}>
                {getEventIcon(event.event_type)}
              </span>
              <span class="activity-text">
                <strong>{event.username}</strong> {getEventAction(event.event_type)}
              </span>
              <span class="activity-time" title={formatFullTime(event.created_at)}>
                {formatTimeAgo(event.created_at)}
              </span>
            </div>
          )}
        </For>
      </div>
    </div>
  );
};

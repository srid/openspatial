/**
 * Activity Panel - displays recent space activity (join/leave events).
 * Expands from control bar button with click-to-toggle behavior.
 */
import type { SpaceActivityItem } from '../../shared/types/events.js';

export class ActivityPanel {
  private container: HTMLElement;
  private button: HTMLElement;
  private badge: HTMLElement;
  private events: SpaceActivityItem[] = [];
  private maxEvents = 10;
  private isOpen = false;
  private hasUnread = false;
  private refreshInterval: number | null = null;

  constructor() {
    this.container = document.getElementById('activity-panel')!;
    this.button = document.getElementById('btn-activity')!;
    this.badge = document.getElementById('activity-badge')!;
    
    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    // Toggle on button click
    this.button.addEventListener('click', (e) => {
      e.stopPropagation();
      this.toggle();
    });

    // Close on click outside
    document.addEventListener('click', (e) => {
      if (this.isOpen && !this.container.contains(e.target as Node)) {
        this.hide();
      }
    });

    // Prevent panel clicks from closing
    this.container.addEventListener('click', (e) => {
      e.stopPropagation();
    });
  }

  /**
   * Update the panel with new activity events.
   */
  update(events: SpaceActivityItem[]): void {
    this.events = events.slice(0, this.maxEvents);
    if (this.isOpen) {
      this.render();
    }
    
    // Show badge if panel is closed and we received new events
    if (!this.isOpen && events.length > 0) {
      this.showBadge();
    }
  }

  toggle(): void {
    if (this.isOpen) {
      this.hide();
    } else {
      this.show();
    }
  }

  show(): void {
    this.isOpen = true;
    this.container.classList.remove('hidden');
    this.button.classList.add('active');
    this.hideBadge();
    this.render();
    
    // Start auto-refresh every 30 seconds while open
    this.refreshInterval = window.setInterval(() => this.render(), 30000);
  }

  hide(): void {
    this.isOpen = false;
    this.container.classList.add('hidden');
    this.button.classList.remove('active');
    
    // Stop auto-refresh
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
      this.refreshInterval = null;
    }
  }

  private showBadge(): void {
    this.hasUnread = true;
    this.badge.classList.remove('hidden');
  }

  private hideBadge(): void {
    this.hasUnread = false;
    this.badge.classList.add('hidden');
  }

  private render(): void {
    if (this.events.length === 0) {
      this.container.innerHTML = '<span class="activity-empty">No recent activity</span>';
      return;
    }

    const items = this.events.map((event) => {
      const eventDate = this.parseUTCDate(event.created_at);
      const timeAgo = this.formatTimeAgo(eventDate);
      const fullTime = this.formatFullTime(eventDate);
      const icon = this.getEventIcon(event.event_type);
      const action = this.getEventAction(event.event_type);
      
      return `
        <div class="activity-item activity-${event.event_type}">
          ${icon}
          <span class="activity-text">
            <strong>${this.escapeHtml(event.username)}</strong> ${action}
          </span>
          <span class="activity-time" title="${fullTime}">${timeAgo}</span>
        </div>
      `;
    }).join('');

    this.container.innerHTML = `
      <div class="activity-header">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"></circle>
          <polyline points="12 6 12 12 16 14"></polyline>
        </svg>
        <span>Recent Activity</span>
      </div>
      <div class="activity-list">${items}</div>
    `;
  }

  private getEventIcon(eventType: string): string {
    switch (eventType) {
      case 'join_first':
        return '<span class="activity-icon activity-icon-join">🟢</span>';
      case 'join':
        return '<span class="activity-icon activity-icon-join">↗</span>';
      case 'leave':
        return '<span class="activity-icon activity-icon-leave">↙</span>';
      case 'leave_last':
        return '<span class="activity-icon activity-icon-leave">⚫</span>';
      default:
        return '<span class="activity-icon">•</span>';
    }
  }

  private getEventAction(eventType: string): string {
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

  private formatTimeAgo(date: Date): string {
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

  /**
   * Parse SQLite datetime as UTC (it returns "YYYY-MM-DD HH:MM:SS" without Z suffix).
   */
  private parseUTCDate(dateStr: string): Date {
    // SQLite datetime('now') returns UTC but without Z suffix
    // Append Z if not present to ensure JavaScript parses as UTC
    const normalized = dateStr.includes('Z') || dateStr.includes('+') 
      ? dateStr 
      : dateStr.replace(' ', 'T') + 'Z';
    return new Date(normalized);
  }

  /**
   * Format full timestamp for hover tooltip (user's local time).
   */
  private formatFullTime(date: Date): string {
    return date.toLocaleString(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  }

  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  clear(): void {
    this.events = [];
    this.container.innerHTML = '';
    this.hide();
  }
}


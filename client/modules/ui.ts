import type { SessionRecord, SessionVisit } from '../../shared/types/session.js';

interface AppState {
  isMuted: boolean;
  isVideoOff: boolean;
}

export class UIController {
  private state: AppState;
  private btnMic: HTMLButtonElement;
  private btnCamera: HTMLButtonElement;
  private btnScreen: HTMLButtonElement;
  private btnHistory: HTMLButtonElement;
  private historyModal: HTMLElement;
  private historyList: HTMLElement;
  private closeHistoryBtn: HTMLButtonElement;

  constructor(state: AppState) {
    this.state = state;
    this.btnMic = document.getElementById('btn-mic') as HTMLButtonElement;
    this.btnCamera = document.getElementById('btn-camera') as HTMLButtonElement;
    this.btnScreen = document.getElementById('btn-screen') as HTMLButtonElement;
    this.btnHistory = document.getElementById('btn-history') as HTMLButtonElement;
    this.historyModal = document.getElementById('history-modal') as HTMLElement;
    this.historyList = document.getElementById('history-list') as HTMLElement;
    this.closeHistoryBtn = document.getElementById('close-history') as HTMLButtonElement;

    this.initializeHistoryListeners();
  }

  private initializeHistoryListeners(): void {
      this.closeHistoryBtn.addEventListener('click', () => {
          this.toggleHistoryModal(false);
      });

      // Close when clicking outside content
      this.historyModal.addEventListener('click', (e) => {
          if (e.target === this.historyModal) {
              this.toggleHistoryModal(false);
          }
      });
  }

  toggleHistoryModal(show: boolean): void {
      if (show) {
          this.historyModal.classList.remove('hidden');
      } else {
          this.historyModal.classList.add('hidden');
      }
  }

  updateHistoryList(sessions: SessionRecord[]): void {
      this.historyList.innerHTML = '';

      if (sessions.length === 0) {
          this.historyList.innerHTML = '<p style="text-align: center; color: var(--color-text-muted);">No recorded sessions yet.</p>';
          return;
      }

      // Sort by start time descending
      const sortedSessions = [...sessions].sort((a, b) => b.startTime - a.startTime);

      sortedSessions.forEach(session => {
          const startTime = new Date(session.startTime).toLocaleString();
          const durationMs = session.endTime ? session.endTime - session.startTime : 0;
          const duration = this.formatDuration(durationMs);

          const uniqueParticipants = Array.from(new Set(session.visits.map((v: SessionVisit) => v.username)));

          const item = document.createElement('div');
          item.className = 'history-item';
          item.innerHTML = `
              <div class="history-header">
                  <span class="history-time">${startTime}</span>
                  <span class="history-duration">${duration}</span>
              </div>
              <div class="history-participants">
                  ${uniqueParticipants.map(name => `<span class="participant-badge">${name}</span>`).join('')}
              </div>
          `;
          this.historyList.appendChild(item);
      });
  }

  private formatDuration(ms: number): string {
      const seconds = Math.floor(ms / 1000);
      const minutes = Math.floor(seconds / 60);
      const hours = Math.floor(minutes / 60);

      if (hours > 0) return `${hours}h ${minutes % 60}m`;
      if (minutes > 0) return `${minutes}m`;
      return `${seconds}s`;
  }

  updateMicButton(isMuted: boolean): void {
    const iconOn = this.btnMic.querySelector('.icon-on') as HTMLElement;
    const iconOff = this.btnMic.querySelector('.icon-off') as HTMLElement;

    if (isMuted) {
      iconOn.classList.add('hidden');
      iconOff.classList.remove('hidden');
      this.btnMic.classList.add('muted');
    } else {
      iconOn.classList.remove('hidden');
      iconOff.classList.add('hidden');
      this.btnMic.classList.remove('muted');
    }
  }

  updateCameraButton(isVideoOff: boolean): void {
    const iconOn = this.btnCamera.querySelector('.icon-on') as HTMLElement;
    const iconOff = this.btnCamera.querySelector('.icon-off') as HTMLElement;

    if (isVideoOff) {
      iconOn.classList.add('hidden');
      iconOff.classList.remove('hidden');
      this.btnCamera.classList.add('muted');
    } else {
      iconOn.classList.remove('hidden');
      iconOff.classList.add('hidden');
      this.btnCamera.classList.remove('muted');
    }
  }

  updateScreenButton(isSharing: boolean): void {
    if (isSharing) {
      this.btnScreen.classList.add('active');
    } else {
      this.btnScreen.classList.remove('active');
    }
  }

  resetButtons(): void {
    this.updateMicButton(false);
    this.updateCameraButton(false);
    this.updateScreenButton(false);
  }
}

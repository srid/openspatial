import type { UIAppState } from '../../shared/types/state.js';

export class UIController {
  private state: UIAppState;
  private btnMic: HTMLButtonElement;
  private btnCamera: HTMLButtonElement;
  private btnScreen: HTMLButtonElement;
  private connectionStatus: HTMLElement;
  private hideConnectionTimeout: number | null = null;

  constructor(state: UIAppState) {
    this.state = state;
    this.btnMic = document.getElementById('btn-mic') as HTMLButtonElement;
    this.btnCamera = document.getElementById('btn-camera') as HTMLButtonElement;
    this.btnScreen = document.getElementById('btn-screen') as HTMLButtonElement;
    this.connectionStatus = document.getElementById('connection-status') as HTMLElement;
  }

  updateMicButton(isMuted: boolean): void {
    if (!this.btnMic) return;
    const iconOn = this.btnMic.querySelector('.icon-on') as HTMLElement;
    const iconOff = this.btnMic.querySelector('.icon-off') as HTMLElement;

    if (isMuted) {
      iconOn?.classList.add('hidden');
      iconOff?.classList.remove('hidden');
      this.btnMic.classList.add('muted');
    } else {
      iconOn?.classList.remove('hidden');
      iconOff?.classList.add('hidden');
      this.btnMic.classList.remove('muted');
    }
  }

  updateCameraButton(isVideoOff: boolean): void {
    if (!this.btnCamera) return;
    const iconOn = this.btnCamera.querySelector('.icon-on') as HTMLElement;
    const iconOff = this.btnCamera.querySelector('.icon-off') as HTMLElement;

    if (isVideoOff) {
      iconOn?.classList.add('hidden');
      iconOff?.classList.remove('hidden');
      this.btnCamera.classList.add('muted');
    } else {
      iconOn?.classList.remove('hidden');
      iconOff?.classList.add('hidden');
      this.btnCamera.classList.remove('muted');
    }
  }

  updateScreenButton(isSharing: boolean): void {
    if (!this.btnScreen) return;
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

  // Connection status banner methods
  private clearHideTimeout(): void {
    if (this.hideConnectionTimeout !== null) {
      window.clearTimeout(this.hideConnectionTimeout);
      this.hideConnectionTimeout = null;
    }
  }

  showDisconnected(): void {
    if (!this.connectionStatus) return;
    this.clearHideTimeout();
    this.connectionStatus.className = 'connection-status disconnected';
    this.connectionStatus.innerHTML = `
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <line x1="1" y1="1" x2="23" y2="23"/>
        <path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55"/>
        <path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39"/>
        <path d="M10.71 5.05A16 16 0 0 1 22.58 9"/>
        <path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88"/>
        <path d="M8.53 16.11a6 6 0 0 1 6.95 0"/>
        <line x1="12" y1="20" x2="12.01" y2="20"/>
      </svg>
      <span>Connection lost. Waiting to reconnect...</span>
    `;
  }

  showReconnecting(attempt: number, maxAttempts: number): void {
    if (!this.connectionStatus) return;
    this.clearHideTimeout();
    this.connectionStatus.className = 'connection-status reconnecting';
    this.connectionStatus.innerHTML = `
      <svg class="spin" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
      </svg>
      <span>Reconnecting... (${attempt}/${maxAttempts})</span>
    `;
  }

  showConnected(): void {
    // Guard: connectionStatus may not exist if Space view isn't rendered yet
    if (!this.connectionStatus) return;
    this.clearHideTimeout();
    this.connectionStatus.className = 'connection-status connected';
    this.connectionStatus.innerHTML = `
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M5 12.55a11 11 0 0 1 14.08 0"/>
        <path d="M1.42 9a16 16 0 0 1 21.16 0"/>
        <path d="M8.53 16.11a6 6 0 0 1 6.95 0"/>
        <line x1="12" y1="20" x2="12.01" y2="20"/>
      </svg>
      <span>Connected</span>
    `;
  }

  hideConnectionStatus(): void {
    if (!this.connectionStatus) return;
    this.clearHideTimeout();
    this.connectionStatus.className = 'connection-status hidden';
    this.connectionStatus.innerHTML = '';
  }
}

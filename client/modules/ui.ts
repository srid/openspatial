/*
 * OpenSpatial
 * Copyright (C) 2025 Sridhar Ratnakumar
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */

interface AppState {
  isMuted: boolean;
  isVideoOff: boolean;
}

export class UIController {
  private state: AppState;
  private btnMic: HTMLButtonElement;
  private btnCamera: HTMLButtonElement;
  private btnScreen: HTMLButtonElement;

  constructor(state: AppState) {
    this.state = state;
    this.btnMic = document.getElementById('btn-mic') as HTMLButtonElement;
    this.btnCamera = document.getElementById('btn-camera') as HTMLButtonElement;
    this.btnScreen = document.getElementById('btn-screen') as HTMLButtonElement;
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

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

import type { AvatarManager } from './avatar.js';
import type { Position } from '../../shared/types/events.js';

declare global {
  interface Window {
    AudioContext: typeof AudioContext;
    webkitAudioContext: typeof AudioContext;
  }
}

interface AudioNodes {
  source: MediaStreamAudioSourceNode;
  gainNode: GainNode;
  pannerNode: StereoPannerNode;
}

export class SpatialAudio {
  private audioContext: AudioContext | null = null;
  private peerAudioNodes = new Map<string, AudioNodes>();
  private analyzerNodes = new Map<string, AnalyserNode>();
  private speakingThreshold = 30;
  private maxDistance = 500;
  private avatars: AvatarManager | null = null;

  setAvatarManager(avatars: AvatarManager): void {
    this.avatars = avatars;
  }

  private initAudioContext(): AudioContext {
    if (!this.audioContext) {
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
    return this.audioContext;
  }

  addPeer(peerId: string, stream: MediaStream): void {
    this.initAudioContext();

    const audioTrack = stream.getAudioTracks()[0];
    if (!audioTrack) return;

    const source = this.audioContext!.createMediaStreamSource(stream);
    const gainNode = this.audioContext!.createGain();
    const pannerNode = this.audioContext!.createStereoPanner();
    const analyzerNode = this.audioContext!.createAnalyser();

    analyzerNode.fftSize = 256;

    source.connect(analyzerNode);
    analyzerNode.connect(gainNode);
    gainNode.connect(pannerNode);
    pannerNode.connect(this.audioContext!.destination);

    this.peerAudioNodes.set(peerId, { source, gainNode, pannerNode });
    this.analyzerNodes.set(peerId, analyzerNode);

    this.startSpeakingDetection(peerId, analyzerNode);
  }

  private startSpeakingDetection(peerId: string, analyzerNode: AnalyserNode): void {
    const dataArray = new Uint8Array(analyzerNode.frequencyBinCount);

    const checkSpeaking = (): void => {
      if (!this.analyzerNodes.has(peerId)) return;

      analyzerNode.getByteFrequencyData(dataArray);

      let sum = 0;
      for (let i = 0; i < dataArray.length; i++) {
        sum += dataArray[i];
      }
      const average = sum / dataArray.length;

      const isSpeaking = average > this.speakingThreshold;
      this.avatars?.setSpeaking(peerId, isSpeaking);

      requestAnimationFrame(checkSpeaking);
    };

    checkSpeaking();
  }

  updatePositions(positions: Map<string, Position>, localPeerId: string): void {
    const localPos = positions.get(localPeerId);
    if (!localPos) return;

    positions.forEach((pos, peerId) => {
      if (peerId === localPeerId) return;

      const nodes = this.peerAudioNodes.get(peerId);
      if (!nodes) return;

      const dx = pos.x - localPos.x;
      const dy = pos.y - localPos.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      const volume = Math.max(0, 1 - distance / this.maxDistance);
      nodes.gainNode.gain.value = volume;

      const pan = Math.max(-1, Math.min(1, dx / (this.maxDistance / 2)));
      nodes.pannerNode.pan.value = pan;
    });
  }

  removePeer(peerId: string): void {
    const nodes = this.peerAudioNodes.get(peerId);
    if (nodes) {
      nodes.source.disconnect();
      nodes.gainNode.disconnect();
      nodes.pannerNode.disconnect();
    }
    this.peerAudioNodes.delete(peerId);
    this.analyzerNodes.delete(peerId);
  }

  clear(): void {
    this.peerAudioNodes.forEach((nodes) => {
      nodes.source.disconnect();
      nodes.gainNode.disconnect();
      nodes.pannerNode.disconnect();
    });
    this.peerAudioNodes.clear();
    this.analyzerNodes.clear();
  }
}

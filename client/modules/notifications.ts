/**
 * Audio Notifications Module
 *
 * Provides audio feedback for key events like users joining or leaving a space.
 * Uses Web Audio API's OscillatorNode to generate tones programmatically,
 * avoiding the need for external audio files.
 */

/** Audio context for generating notification sounds */
let audioContext: AudioContext | null = null;

/**
 * Initialize the audio context lazily (requires user interaction first).
 */
function getAudioContext(): AudioContext {
  if (!audioContext) {
    audioContext = new AudioContext();
  }
  return audioContext;
}

/**
 * Play a simple tone using the Web Audio API.
 * @param frequency - The frequency in Hz
 * @param duration - Duration in milliseconds
 * @param type - Oscillator wave type
 * @param volumeMultiplier - Volume multiplier (0-1)
 */
function playTone(
  frequency: number,
  duration: number,
  type: OscillatorType = 'sine',
  volumeMultiplier: number = 0.15
): void {
  try {
    const ctx = getAudioContext();
    if (ctx.state === 'suspended') {
      ctx.resume();
    }

    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();

    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, ctx.currentTime);

    // Envelope: quick attack, gradual decay for a pleasant sound
    gainNode.gain.setValueAtTime(0, ctx.currentTime);
    gainNode.gain.linearRampToValueAtTime(volumeMultiplier, ctx.currentTime + 0.02);
    gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration / 1000);

    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);

    oscillator.start(ctx.currentTime);
    oscillator.stop(ctx.currentTime + duration / 1000);
  } catch (e) {
    // Silently ignore audio errors (e.g., in headless test environments)
    console.debug('Audio notification failed:', e);
  }
}

/**
 * Play a "user joined" notification sound.
 * Uses an ascending two-tone chime for a welcoming feeling.
 */
export function playJoinSound(): void {
  // Pleasant ascending two-note chime (C5 -> E5)
  playTone(523, 150, 'sine', 0.12); // C5
  setTimeout(() => playTone(659, 200, 'sine', 0.1), 120); // E5
}

/**
 * Play a "user left" notification sound.
 * Uses a descending single tone for a muted departure feel.
 */
export function playLeaveSound(): void {
  // Soft descending tone (G4)
  playTone(392, 200, 'sine', 0.08);
}

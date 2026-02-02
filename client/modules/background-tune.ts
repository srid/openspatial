/**
 * Background Tune Module
 *
 * Plays a gentle melodic tune when the user is alone in a space (< 2 participants).
 * Uses Web Audio API to create pleasant, looping ambient music.
 * Inspired by Slack's "hold music" while waiting for others.
 */

/** Audio context for ambient sound generation */
let audioContext: AudioContext | null = null;

/** Currently playing state */
let isPlaying = false;
let melodyInterval: ReturnType<typeof setInterval> | null = null;
let masterGain: GainNode | null = null;

/** Fade duration in seconds */
const FADE_DURATION = 1.0;

/** Base volume for the ambient tune */
const BASE_VOLUME = 0.05;

/** Note duration in ms */
const NOTE_DURATION = 800;

/** Gap between notes in ms */
const NOTE_GAP = 1200;

/**
 * Musical notes frequencies (Hz) - pentatonic scale for pleasant sound
 */
const NOTES = {
  C4: 261.63,
  D4: 293.66,
  E4: 329.63,
  G4: 392.0,
  A4: 440.0,
  C5: 523.25,
  D5: 587.33,
  E5: 659.25,
};

/**
 * A pleasant, calming melody using pentatonic scale
 */
const MELODY = [
  NOTES.E4,
  NOTES.G4,
  NOTES.A4,
  NOTES.G4,
  NOTES.E4,
  NOTES.D4,
  NOTES.C4,
  NOTES.D4,
  NOTES.E4,
  NOTES.G4,
  NOTES.C5,
  NOTES.A4,
  NOTES.G4,
  NOTES.E4,
  NOTES.G4,
  NOTES.A4,
];

/**
 * Initialize or get the audio context.
 */
function getAudioContext(): AudioContext {
  if (!audioContext) {
    audioContext = new AudioContext();
  }
  return audioContext;
}

/**
 * Play a single note with piano-like envelope
 */
function playNote(frequency: number, gain: GainNode): void {
  const ctx = audioContext!;

  const oscillator = ctx.createOscillator();
  const noteGain = ctx.createGain();

  // Use triangle wave for softer, more pleasant sound
  oscillator.type = 'triangle';
  oscillator.frequency.setValueAtTime(frequency, ctx.currentTime);

  // Piano-like envelope: quick attack, gradual decay
  const now = ctx.currentTime;
  noteGain.gain.setValueAtTime(0, now);
  noteGain.gain.linearRampToValueAtTime(0.15, now + 0.05); // Soft attack
  noteGain.gain.exponentialRampToValueAtTime(0.01, now + NOTE_DURATION / 1000); // Decay

  oscillator.connect(noteGain);
  noteGain.connect(gain);

  oscillator.start(now);
  oscillator.stop(now + NOTE_DURATION / 1000);
}

/**
 * Start playing the ambient background melody.
 */
export function startBackgroundTune(): void {
  if (isPlaying) return;

  try {
    const ctx = getAudioContext();
    if (ctx.state === 'suspended') {
      ctx.resume();
    }

    // Master gain for fade in/out
    masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(0, ctx.currentTime);
    masterGain.gain.linearRampToValueAtTime(BASE_VOLUME, ctx.currentTime + FADE_DURATION);
    masterGain.connect(ctx.destination);

    isPlaying = true;
    let noteIndex = 0;

    // Play melody in a loop
    const playNextNote = (): void => {
      if (!isPlaying || !masterGain) return;

      playNote(MELODY[noteIndex], masterGain);
      noteIndex = (noteIndex + 1) % MELODY.length;
    };

    // Start immediately, then continue on interval
    playNextNote();
    melodyInterval = setInterval(playNextNote, NOTE_DURATION + NOTE_GAP);

    // Expose state for E2E testing
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).__backgroundTunePlaying = true;
  } catch (e) {
    console.debug('Background tune failed to start:', e);
  }
}

/**
 * Stop playing the background tune with a fade out.
 */
export function stopBackgroundTune(): void {
  if (!isPlaying) return;

  // Expose state for E2E testing immediately
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (window as any).__backgroundTunePlaying = false;

  try {
    if (melodyInterval) {
      clearInterval(melodyInterval);
      melodyInterval = null;
    }

    if (masterGain && audioContext) {
      // Fade out
      masterGain.gain.cancelScheduledValues(audioContext.currentTime);
      masterGain.gain.setValueAtTime(masterGain.gain.value, audioContext.currentTime);
      masterGain.gain.linearRampToValueAtTime(0, audioContext.currentTime + FADE_DURATION);

      // Disconnect after fade
      setTimeout(() => {
        masterGain?.disconnect();
        masterGain = null;
      }, FADE_DURATION * 1000 + 100);
    }

    isPlaying = false;
  } catch (e) {
    console.debug('Background tune failed to stop:', e);
  }
}

/**
 * Update background tune state based on participant count.
 * Starts the tune when solo (count < 2), stops when others join.
 */
export function updateBackgroundTune(participantCount: number): void {
  if (participantCount < 2) {
    startBackgroundTune();
  } else {
    stopBackgroundTune();
  }
}

/**
 * Check if background tune is currently playing.
 */
export function isBackgroundTunePlaying(): boolean {
  return isPlaying;
}

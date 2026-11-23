/**
 * Locally generated call progress tones (WebAudio), 425 Hz as on RU/EU networks:
 *  - ringback:   1 s on / 4 s off, until stopped
 *  - busy:       0.35 s on / 0.35 s off
 *  - congestion: 0.175 s on / 0.175 s off ("fast busy")
 */

const FREQUENCY = 425;
const VOLUME = 0.15;
const RINGBACK_MAX_SECONDS = 180;

type Pattern = { on: number; off: number };
const PATTERNS = {
  ringback: { on: 1, off: 4 },
  busy: { on: 0.35, off: 0.35 },
  congestion: { on: 0.175, off: 0.175 },
} satisfies Record<string, Pattern>;

export type ToneKind = keyof typeof PATTERNS;

let ctx: AudioContext | null = null;
let current: { kind: ToneKind; osc: OscillatorNode; gain: GainNode; timer?: ReturnType<typeof setTimeout> } | null = null;

const getContext = (): AudioContext | null => {
  if (typeof window === 'undefined') return null;
  if (!ctx) {
    const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
  }
  if (ctx.state === 'suspended') ctx.resume().catch(() => undefined);
  return ctx;
};

/**
 * Call from a user gesture (the "call" tap) so iOS/Telegram WebView lets the
 * context start — tones are played later from SIP callbacks, outside the gesture.
 */
export const unlockTones = () => {
  getContext();
};

export const stopTone = () => {
  if (!current) return;
  const { osc, gain, timer } = current;
  current = null;
  if (timer) clearTimeout(timer);
  try {
    osc.stop();
  } catch {
    // already stopped
  }
  osc.disconnect();
  gain.disconnect();
};

/**
 * Plays a tone pattern. `durationMs` limits it (rounded down to whole cycles
 * so it doesn't end mid-beep); omit to play until stopTone().
 */
export const playTone = (kind: ToneKind, durationMs?: number, onDone?: () => void) => {
  stopTone();
  const audio = getContext();
  if (!audio) {
    if (durationMs !== undefined && onDone) setTimeout(onDone, durationMs);
    return;
  }

  const { on, off } = PATTERNS[kind];
  const cycle = on + off;
  const totalSeconds = durationMs !== undefined ? durationMs / 1000 : RINGBACK_MAX_SECONDS;
  const cycles = Math.max(1, Math.floor(totalSeconds / cycle));

  const osc = audio.createOscillator();
  const gain = audio.createGain();
  osc.type = 'sine';
  osc.frequency.value = FREQUENCY;
  osc.connect(gain);
  gain.connect(audio.destination);

  const start = audio.currentTime + 0.02;
  gain.gain.setValueAtTime(0, audio.currentTime);
  for (let i = 0; i < cycles; i++) {
    const t = start + i * cycle;
    // short ramps avoid clicks at the edges of each beep
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(VOLUME, t + 0.01);
    gain.gain.setValueAtTime(VOLUME, t + on - 0.01);
    gain.gain.linearRampToValueAtTime(0, t + on);
  }
  osc.start(start);
  osc.stop(start + cycles * cycle);

  const entry: NonNullable<typeof current> = { kind, osc, gain };
  current = entry;
  osc.onended = () => {
    if (current !== entry) return; // replaced by another tone
    stopTone();
    onDone?.();
  };
};

export const currentTone = (): ToneKind | null => current?.kind ?? null;

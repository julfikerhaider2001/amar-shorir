/**
 * Click "pop" + pre-recorded Bangla narration, in the voice the child picked.
 *
 * - One shared <audio> element, so starting a new narration always stops the
 *   previous one — sounds never overlap.
 * - Everything starts from a click/tap handler, which keeps mobile autoplay
 *   rules happy. Nothing plays on page load.
 * - The pop is synthesised with Web Audio, so no third-party audio ships.
 * - Failures (missing file, decode error, blocked playback) are swallowed:
 *   a silent tap is fine, a crash is not.
 * - Mute, voice and speed are kept in localStorage.
 */
import voiceData from "./voices.json";
import { clipUrl } from "./paths";

const MUTED_KEY = "amar-shorir:muted";
const VOICE_KEY = "amar-shorir:voice";
const SLOW_KEY = "amar-shorir:slow";
/** Slow mode stretches the clip; the browser keeps the pitch natural. */
const SLOW_RATE = 0.82;

const voiceIds = new Set(voiceData.voices.map((voice) => voice.id));
export const defaultVoice = voiceData.default;

type WebkitWindow = Window & { webkitAudioContext?: typeof AudioContext };

function load(key: string) {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function save(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Private mode or storage disabled — the choice just won't persist.
  }
}

class SoundPlayer {
  private narration: HTMLAudioElement | null = null;
  private context: AudioContext | null = null;
  private muted: boolean | null = null;
  private voice: string | null = null;
  private slow: boolean | null = null;
  private listeners = new Set<() => void>();
  private warmed = new Set<string>();

  isMuted = () => (this.muted ??= load(MUTED_KEY) === "1");

  getVoice = () => {
    if (this.voice === null) {
      const stored = load(VOICE_KEY);
      this.voice = stored && voiceIds.has(stored) ? stored : defaultVoice;
    }
    return this.voice;
  };

  isSlow = () => (this.slow ??= load(SLOW_KEY) === "1");

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  private changed() {
    this.listeners.forEach((listener) => listener());
  }

  setMuted(muted: boolean) {
    this.muted = muted;
    save(MUTED_KEY, muted ? "1" : "0");
    if (muted) this.stop();
    this.changed();
  }

  setVoice(voice: string) {
    if (!voiceIds.has(voice)) return;
    this.voice = voice;
    save(VOICE_KEY, voice);
    this.changed();
  }

  setSlow(slow: boolean) {
    this.slow = slow;
    save(SLOW_KEY, slow ? "1" : "0");
    if (this.narration) this.narration.playbackRate = slow ? SLOW_RATE : 1;
    this.changed();
  }

  stop() {
    this.narration?.pause();
  }

  /** Pop now, then `clip` (see clips.ts) in the chosen voice. Call from a
   *  click/tap handler. */
  play(clip: string) {
    if (this.isMuted()) return;
    this.pop();
    try {
      const audio = (this.narration ??= new Audio());
      audio.pause();
      audio.preload = "auto";
      audio.src = clipUrl(this.getVoice(), clip);
      audio.currentTime = 0;
      // Some browsers reset the rate when the source changes.
      audio.defaultPlaybackRate = audio.playbackRate = this.isSlow() ? SLOW_RATE : 1;
      void audio.play().catch(() => {});
    } catch {
      // No <audio> support — stay silent.
    }
  }

  /** Pulls clips of the current voice into the HTTP cache so the next tap
   *  starts instantly. */
  warm(clipNames: string[]) {
    const voice = this.getVoice();
    clipNames.forEach((clip) => {
      const src = clipUrl(voice, clip);
      if (this.warmed.has(src)) return;
      this.warmed.add(src);
      void fetch(src, { priority: "low" } as RequestInit).catch(() => this.warmed.delete(src));
    });
  }

  /** A short, soft "bloop": a sine sweeping up with a quick fade. */
  private pop() {
    try {
      const Context = window.AudioContext ?? (window as WebkitWindow).webkitAudioContext;
      if (!Context) return;
      const context = (this.context ??= new Context());
      if (context.state === "suspended") void context.resume();
      const now = context.currentTime;
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(420, now);
      oscillator.frequency.exponentialRampToValueAtTime(980, now + 0.09);
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.22, now + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.14);
      oscillator.connect(gain).connect(context.destination);
      oscillator.start(now);
      oscillator.stop(now + 0.15);
    } catch {
      // Web Audio unavailable — skip the pop, narration still plays.
    }
  }
}

export const sound = new SoundPlayer();

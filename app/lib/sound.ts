/**
 * Click "pop" + pre-recorded Bangla narration.
 *
 * - One shared <audio> element, so starting a new narration always stops the
 *   previous one — sounds never overlap.
 * - Everything starts from a click/tap handler, which keeps mobile autoplay
 *   rules happy. Nothing plays on page load.
 * - The pop is synthesised with Web Audio, so no third-party audio ships.
 * - Failures (missing file, decode error, blocked playback) are swallowed:
 *   a silent tap is fine, a crash is not.
 */

const STORAGE_KEY = "amar-shorir:muted";

type WebkitWindow = Window & { webkitAudioContext?: typeof AudioContext };

class SoundPlayer {
  private narration: HTMLAudioElement | null = null;
  private context: AudioContext | null = null;
  private muted: boolean | null = null;
  private listeners = new Set<() => void>();
  private warmed = new Set<string>();

  isMuted = () => {
    if (this.muted === null) {
      try {
        this.muted = window.localStorage.getItem(STORAGE_KEY) === "1";
      } catch {
        this.muted = false;
      }
    }
    return this.muted;
  };

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  setMuted(muted: boolean) {
    this.muted = muted;
    try {
      window.localStorage.setItem(STORAGE_KEY, muted ? "1" : "0");
    } catch {
      // Private mode or storage disabled — the choice just won't persist.
    }
    if (muted) this.stop();
    this.listeners.forEach((listener) => listener());
  }

  stop() {
    this.narration?.pause();
  }

  /** Pop now, narration straight after. Call from a click/tap handler. */
  play(src: string) {
    if (this.isMuted()) return;
    this.pop();
    try {
      const audio = (this.narration ??= new Audio());
      audio.pause();
      audio.preload = "auto";
      audio.src = src;
      audio.currentTime = 0;
      void audio.play().catch(() => {});
    } catch {
      // No <audio> support — stay silent.
    }
  }

  /** Pulls files into the HTTP cache so the next tap starts instantly. */
  warm(sources: string[]) {
    sources.forEach((src) => {
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

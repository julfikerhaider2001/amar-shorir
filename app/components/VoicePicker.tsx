"use client";

import { useSyncExternalStore } from "react";
import { Dialog } from "./Dialog";
import { t, voiceOptions } from "../i18n";
import { clips } from "../lib/clips";
import { defaultVoice, sound } from "../lib/sound";

const useVoice = () => useSyncExternalStore(sound.subscribe, sound.getVoice, () => defaultVoice);
const useSlow = () => useSyncExternalStore(sound.subscribe, sound.isSlow, () => false);

/** Top-bar button showing the current narrator's face. */
export function VoiceButton({ onOpen }: { onOpen: () => void }) {
  const voice = useVoice();
  const current = voiceOptions.find((option) => option.id === voice) ?? voiceOptions[0];
  return (
    <button type="button" className="round-button voice-button" onClick={onOpen} aria-label={t.settings.open} title={t.settings.open} data-testid="voice-button">
      <span aria-hidden>{current.icon}</span>
    </button>
  );
}

/** Pick who reads aloud, and how fast. Each choice speaks straight away so a
 *  child who can't read the names can still choose by ear. */
export function VoicePicker({ onClose }: { onClose: () => void }) {
  const voice = useVoice();
  const slow = useSlow();

  const choose = (id: string) => {
    sound.setVoice(id);
    sound.play(clips.hello);
  };

  const setSpeed = (value: boolean) => {
    sound.setSlow(value);
    sound.play(clips.hello);
  };

  return (
    <Dialog title={t.settings.title} closeLabel={t.viewer.close} onClose={onClose} className="wide voice-modal">
      <p>{t.settings.hint}</p>
      <div className="voice-grid" role="radiogroup" aria-label={t.settings.title}>
        {voiceOptions.map((option) => (
          <button
            key={option.id}
            type="button"
            role="radio"
            aria-checked={voice === option.id}
            className={`voice-card ${voice === option.id ? "active" : ""}`}
            onClick={() => choose(option.id)}
            data-voice={option.id}
          >
            <span className="voice-face" aria-hidden>{option.icon}</span>
            <b>{option.name}</b>
            <small>{option.about}</small>
          </button>
        ))}
      </div>

      <h3 className="speed-title">{t.settings.speed}</h3>
      <div className="speed-toggle" role="radiogroup" aria-label={t.settings.speed}>
        <button type="button" role="radio" aria-checked={!slow} className={!slow ? "active" : ""} onClick={() => setSpeed(false)}>
          <span aria-hidden>🐇</span> {t.settings.normal}
        </button>
        <button type="button" role="radio" aria-checked={slow} className={slow ? "active" : ""} onClick={() => setSpeed(true)} data-testid="slow-button">
          <span aria-hidden>🐢</span> {t.settings.slow}
        </button>
      </div>

      <button type="button" className="lesson-button" onClick={onClose}>{t.settings.done} <span aria-hidden>👍</span></button>
    </Dialog>
  );
}

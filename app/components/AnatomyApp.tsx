"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import gsap from "gsap";
import { Heart, Play, Volume2 } from "lucide-react";
import { App as NativeApp } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";
import { Dialog } from "./Dialog";
import { OrganArt } from "./OrganArt";
import { OrganViewer } from "./OrganViewer";
import { Quiz, makeQuiz, type QuizRound } from "./Quiz";
import { VoiceButton, VoicePicker } from "./VoicePicker";
import type { OrganId } from "../lib/anatomy-data";
import { format, organById, organs, t, type Hotspot, type Organ } from "../i18n";
import { clips } from "../lib/clips";
import { withBase } from "../lib/paths";
import { sound } from "../lib/sound";

type Modal = "body" | "move" | "voice" | null;

/** 🔊 / 🔇 — the choice is kept in localStorage by `sound`. */
function MuteButton() {
  const muted = useSyncExternalStore(sound.subscribe, sound.isMuted, () => false);
  return (
    <button
      type="button"
      className={`round-button mute-button ${muted ? "is-muted" : ""}`}
      onClick={() => sound.setMuted(!muted)}
      aria-pressed={muted}
      aria-label={muted ? t.sound.unmute : t.sound.mute}
      title={muted ? t.sound.unmute : t.sound.mute}
      data-testid="mute-button"
    >
      <span aria-hidden>{muted ? "🔇" : "🔊"}</span>
    </button>
  );
}

const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";
function subscribeReducedMotion(onChange: () => void) {
  const query = window.matchMedia(REDUCED_MOTION);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

export function AnatomyApp() {
  const [organId, setOrganId] = useState<OrganId>("heart");
  // The model spins on its own unless the device asks for less motion; the
  // Rotate button overrides either way.
  const reducedMotion = useSyncExternalStore(subscribeReducedMotion, () => window.matchMedia(REDUCED_MOTION).matches, () => false);
  const [rotateChoice, setAutoRotate] = useState<boolean | null>(null);
  const autoRotate = rotateChoice ?? !reducedMotion;
  const [modal, setModal] = useState<Modal>(null);
  const [quiz, setQuiz] = useState<{ run: number; rounds: QuizRound[] } | null>(null);
  const voice = useSyncExternalStore(sound.subscribe, sound.getVoice, () => "");
  const contentRef = useRef<HTMLDivElement>(null);
  const prefetched = useRef(new Set<OrganId>());
  const organ = organById[organId];

  useEffect(() => {
    if (!contentRef.current) return;
    gsap.fromTo(contentRef.current.querySelectorAll("[data-reveal]"),
      { opacity: 0, y: 10 },
      { opacity: 1, y: 0, duration: 0.5, stagger: 0.05, ease: "back.out(1.6)", overwrite: true },
    );
  }, [organId]);

  // Nothing is downloaded before the child shows interest. The first touch
  // anywhere pulls every organ's narration (~75 KB each) into the cache, so
  // later taps speak immediately.
  // Re-runs when the voice changes, so the new voice is warmed too.
  useEffect(() => {
    if (!voice) return;
    const warm = () => sound.warm(organs.map((item) => clips.organ(item.id)));
    window.addEventListener("pointerdown", warm, { once: true });
    return () => window.removeEventListener("pointerdown", warm);
  }, [voice]);

  useEffect(() => {
    if (!voice) return;
    sound.warm(organ.hotspots.map((hotspot) => clips.hotspot(organ.id, hotspot.id)));
  }, [organ, voice]);

  // Offline support for the website. The phone apps already carry every file.
  useEffect(() => {
    if (Capacitor.isNativePlatform() || process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    void navigator.serviceWorker.register(withBase("/sw.js"), { scope: withBase("/") }).catch(() => {});
  }, []);

  const closeModal = useCallback(() => setModal(null), []);
  const closeQuiz = useCallback(() => {
    sound.stop();
    setQuiz(null);
  }, []);

  // Android's back button closes a pop-up first, and only then leaves the app.
  const backRef = useRef<() => void>(() => {});
  useEffect(() => {
    backRef.current = () => {
      if (quiz) closeQuiz();
      else if (modal) closeModal();
      else void NativeApp.exitApp();
    };
  });
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    const listener = NativeApp.addListener("backButton", () => backRef.current());
    return () => void listener.then((handle) => handle.remove());
  }, []);

  const sayOrgan = (id: OrganId) => sound.play(clips.organ(id));
  const sayHotspot = (hotspot: Hotspot) => sound.play(clips.hotspot(hotspot.organId, hotspot.id));

  const startQuiz = () => {
    const rounds = makeQuiz();
    setQuiz((current) => ({ run: (current?.run ?? 0) + 1, rounds }));
    sound.play(clips.quizAsk(rounds[0].target));
  };

  const selectOrgan = (id: OrganId) => {
    if (organById[id].illustrated) {
      ["organ", "location"].forEach((asset) => {
        const image = new Image();
        image.src = withBase(`/anatomy/${id}/${asset}.webp`);
      });
    }
    setOrganId(id);
    sayOrgan(id);
  };

  // Warms the model in the HTTP cache while the pointer is still travelling,
  // so the switch usually renders without a visible loading pass.
  const prefetchOrgan = (id: OrganId) => {
    if (id === organId || prefetched.current.has(id)) return;
    prefetched.current.add(id);
    void fetch(organById[id].model, { priority: "low" } as RequestInit).catch(() => {});
  };

  return (
    <main className="app-shell">
      <header className="topbar">
        <button className="brand" type="button" onClick={() => setOrganId("heart")} aria-label={t.brand.home}>
          <span className="brand-mark" aria-hidden><Heart size={26} fill="currentColor" /></span>
          <span className="brand-text">
            <strong>{t.brand.name}</strong>
            <em>{t.brand.tagline}</em>
          </span>
        </button>
        <div className="topbar-actions">
          <VoiceButton onOpen={() => setModal("voice")} />
          <MuteButton />
        </div>
      </header>

      <div className="workspace">
        <nav className="organ-library" aria-label={t.library.title}>
          <h2 className="panel-heading">{t.library.title}</h2>
          <div className="organ-list">
            {organs.map((item) => (
              <button
                type="button"
                key={item.id}
                className={`organ-item ${organId === item.id ? "active" : ""}`}
                onClick={() => selectOrgan(item.id)}
                onPointerEnter={() => prefetchOrgan(item.id)}
                onFocus={() => prefetchOrgan(item.id)}
                aria-pressed={organId === item.id}
                aria-label={format(t.library.pick, { organ: item.name })}
                style={{ "--item-accent": item.accent } as React.CSSProperties}
                data-organ={item.id}
              >
                <span className="organ-glyph">
                  <OrganArt organ={item} asset="thumb" size={64} />
                </span>
                <b>{item.name}</b>
              </button>
            ))}
          </div>
        </nav>

        <OrganViewer
          organ={organ}
          autoRotate={autoRotate}
          onAutoRotate={setAutoRotate}
          onOrganTap={() => sayOrgan(organ.id)}
          onHotspotTap={sayHotspot}
        />

        <aside className="info-panel" ref={contentRef} aria-live="polite" style={{ "--organ-accent": organ.accent } as React.CSSProperties}>
          <div className="info-title-row" data-reveal>
            <button
              type="button"
              className="specimen-stamp"
              onClick={() => sayOrgan(organ.id)}
              aria-label={format(t.info.listen, { organ: organ.name })}
            >
              <OrganArt organ={organ} asset="organ" size={110} />
            </button>
            <div>
              <h1>{organ.name}</h1>
              <em>{organ.nickname}</em>
            </div>
          </div>
          <p className="description" data-reveal>{organ.intro}</p>
          <button type="button" className="listen-button" data-reveal onClick={() => sayOrgan(organ.id)}>
            <Volume2 size={24} aria-hidden /> {t.sound.replay}
          </button>
          <dl className="key-facts">
            <div data-reveal className="fact-where"><dt><span aria-hidden>📍</span>{t.info.where}</dt><dd>{organ.where}</dd></div>
            <div data-reveal className="fact-size"><dt><span aria-hidden>📏</span>{t.info.size}</dt><dd>{organ.size}</dd></div>
            <div data-reveal className="fact-job"><dt><span aria-hidden>💪</span>{t.info.job}</dt><dd>{organ.job}</dd></div>
            <div data-reveal className="fact-daily"><dt><span aria-hidden>📅</span>{t.info.daily}</dt><dd>{organ.daily}</dd></div>
          </dl>
          <div className="fun-note" data-reveal>
            <span aria-hidden>⭐</span>
            <p><b>{t.info.funFact}</b>{organ.funFact}</p>
          </div>
        </aside>
      </div>

      <section className="learning-cards" aria-label={format(t.cards.label, { organ: organ.name })}>
        <button type="button" className="picture-card quiz-card" onClick={startQuiz} aria-label={t.quiz.cardAria} data-testid="quiz-start">
          <span className="picture-card-art quiz-card-art" aria-hidden>
            {["heart", "brain", "lungs"].map((id) => (
              <span key={id} className="quiz-card-thumb"><OrganArt organ={organById[id as OrganId]} asset="thumb" size={96} /></span>
            ))}
            <span className="quiz-card-target">🎯</span>
          </span>
          <span className="picture-card-label"><span aria-hidden>🎮</span> {t.quiz.card}</span>
        </button>
        <button
          type="button"
          className="picture-card system-card"
          onClick={() => setModal("body")}
          aria-label={format(t.cards.bodyAria, { organ: organ.name })}
        >
          <span className="picture-card-art"><OrganArt organ={organ} asset="location" /></span>
          <span className="picture-card-label"><span aria-hidden>🧍</span> {t.cards.body}</span>
        </button>
        <button
          type="button"
          className="picture-card move-card"
          onClick={() => setModal("move")}
          aria-label={format(t.cards.moveAria, { organ: organ.name })}
        >
          <span className="picture-card-art function-visual">
            <OrganArt organ={organ} asset="organ" />
            <i className="function-pulse" />
            <span className="play-badge"><Play size={22} fill="currentColor" /></span>
          </span>
          <span className="picture-card-label"><span aria-hidden>▶️</span> {t.cards.move}</span>
        </button>
      </section>

      {(modal === "body" || modal === "move") && <LearningModal type={modal} organ={organ} onClose={closeModal} />}
      {modal === "voice" && <VoicePicker onClose={closeModal} />}
      {quiz && <Quiz key={quiz.run} rounds={quiz.rounds} onRestart={startQuiz} onClose={closeQuiz} />}
    </main>
  );
}

function LearningModal({ type, organ, onClose }: { type: "body" | "move"; organ: Organ; onClose: () => void }) {
  const vars = { organ: organ.name, where: organ.where };
  return (
    <Dialog
      title={format(type === "body" ? t.modal.bodyTitle : t.modal.moveTitle, vars)}
      closeLabel={t.modal.close}
      onClose={onClose}
      className={type === "body" ? "wide" : ""}
    >
      {type === "body" ? (
        <>
          <p>{format(t.modal.bodyText, vars)}</p>
          <figure className="modal-figure"><OrganArt organ={organ} asset="location" /></figure>
        </>
      ) : (
        <>
          <p>{format(t.modal.moveText, vars)}</p>
          <div className="modal-demo moving"><OrganArt organ={organ} asset="organ" /></div>
        </>
      )}
      <button type="button" className="lesson-button" onClick={onClose}>{t.modal.continue} <span aria-hidden>🎈</span></button>
    </Dialog>
  );
}

"use client";

import { useState } from "react";
import { Volume2 } from "lucide-react";
import { Dialog } from "./Dialog";
import { OrganArt } from "./OrganArt";
import { format, organById, organs, t, toBanglaDigits } from "../i18n";
import type { OrganId } from "../lib/anatomy-data";
import { clips } from "../lib/clips";
import { sound } from "../lib/sound";

export const QUIZ_ROUNDS = 5;
const OPTIONS = 4;

export type QuizRound = { target: OrganId; options: OrganId[] };

const randomIndex = (length: number) => Math.floor(Math.random() * length);

function shuffle<T>(items: T[]) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = randomIndex(i + 1);
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/** Five different organs to find, each hidden among three others. */
export function makeQuiz(): QuizRound[] {
  const ids = organs.map((organ) => organ.id);
  return shuffle(ids)
    .slice(0, QUIZ_ROUNDS)
    .map((target) => ({
      target,
      options: shuffle([target, ...shuffle(ids.filter((id) => id !== target)).slice(0, OPTIONS - 1)]),
    }));
}

/**
 * "Where is the heart?" — the question is spoken, the answers are pictures, so
 * children who can't read yet can play. A star for every organ found on the
 * first try. Every sound starts from a tap: the parent plays the first
 * question when it opens the game.
 */
export function Quiz({ rounds, onRestart, onClose }: { rounds: QuizRound[]; onRestart: () => void; onClose: () => void }) {
  const [index, setIndex] = useState(0);
  const [wrong, setWrong] = useState<OrganId[]>([]);
  const [solved, setSolved] = useState(false);
  const [stars, setStars] = useState(0);
  const [finished, setFinished] = useState(false);
  const [cheer, setCheer] = useState(0);

  const round = rounds[index];
  const target = organById[round.target];

  const answer = (id: OrganId) => {
    if (solved || wrong.includes(id)) return;
    if (id === round.target) {
      setSolved(true);
      if (wrong.length === 0) setStars((value) => value + 1);
      const pick = randomIndex(t.quiz.right.length);
      setCheer(pick);
      sound.play(clips.quizRight(pick + 1));
    } else {
      setWrong((list) => [...list, id]);
      sound.play(clips.quizWrong);
    }
  };

  const next = () => {
    if (index + 1 >= rounds.length) {
      setFinished(true);
      sound.play(clips.quizDone);
      return;
    }
    setIndex(index + 1);
    setWrong([]);
    setSolved(false);
    sound.play(clips.quizAsk(rounds[index + 1].target));
  };

  if (finished) {
    return (
      <Dialog title={t.quiz.done} closeLabel={t.quiz.close} onClose={onClose} className="quiz-modal">
        <p className="quiz-stars" aria-hidden>
          {rounds.map((_, i) => <span key={i} className={i < stars ? "won" : ""}>{i < stars ? "⭐" : "☆"}</span>)}
        </p>
        <p className="quiz-score" data-testid="quiz-score">
          {format(t.quiz.score, { total: toBanglaDigits(rounds.length), score: toBanglaDigits(stars) })}
        </p>
        <button type="button" className="lesson-button" onClick={onRestart}>{t.quiz.again} <span aria-hidden>🔁</span></button>
      </Dialog>
    );
  }

  return (
    <Dialog title={t.quiz.title} closeLabel={t.quiz.close} onClose={onClose} className="wide quiz-modal">
      <div className="quiz-head">
        <span className="quiz-progress">{format(t.quiz.progress, { current: toBanglaDigits(index + 1), total: toBanglaDigits(rounds.length) })}</span>
        <span className="quiz-tally" aria-hidden>⭐ {toBanglaDigits(stars)}</span>
      </div>
      <button type="button" className="quiz-question" onClick={() => sound.play(clips.quizAsk(round.target))} aria-label={t.quiz.replay}>
        <Volume2 size={28} aria-hidden />
        <span>{format(t.quiz.ask, { organ: target.name })}</span>
      </button>

      <div className="quiz-options">
        {round.options.map((id) => {
          const organ = organById[id];
          const isWrong = wrong.includes(id);
          const isRight = solved && id === round.target;
          return (
            <button
              key={`${index}-${id}`}
              type="button"
              className={`quiz-option ${isWrong ? "is-wrong" : ""} ${isRight ? "is-right" : ""}`}
              style={{ "--item-accent": organ.accent } as React.CSSProperties}
              onClick={() => answer(id)}
              aria-label={format(t.quiz.option, { organ: organ.name })}
              aria-disabled={isWrong || solved}
              data-organ={id}
            >
              <span className="quiz-art"><OrganArt organ={organ} asset="organ" size={140} /></span>
              {(isRight || isWrong) && <b>{organ.name}</b>}
              {isRight && <i className="quiz-badge" aria-hidden>✓</i>}
              {isWrong && <i className="quiz-badge" aria-hidden>✗</i>}
            </button>
          );
        })}
      </div>

      <p className="quiz-feedback" role="status">{solved ? t.quiz.right[cheer] : wrong.length ? t.quiz.wrong : ""}</p>
      {solved && (
        <button type="button" className="lesson-button" onClick={next} data-testid="quiz-next">
          {t.quiz.next} <span aria-hidden>➜</span>
        </button>
      )}
    </Dialog>
  );
}

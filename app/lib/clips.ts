import type { OrganId } from "./anatomy-data";

/** Every narration clip, as a path inside a voice's folder. Keep in sync with
 *  `clips()` in scripts/generate-audio.mjs. */
export const clips = {
  /** intro + fun fact */
  organ: (organId: OrganId) => `${organId}.mp3`,
  /** label + detail of one coloured dot */
  hotspot: (organId: OrganId, hotspotId: string) => `${organId}/${hotspotId}.mp3`,
  /** the voice introducing itself in the voice picker */
  hello: "hello.mp3",
  quizAsk: (organId: OrganId) => `quiz/${organId}.mp3`,
  /** 1-based; one per entry of `quiz.right` in bn.json */
  quizRight: (index: number) => `quiz/right-${index}.mp3`,
  quizWrong: "quiz/wrong.mp3",
  quizDone: "quiz/done.mp3",
};

/**
 * Public-folder URLs. On GitHub Pages the site lives under `/<repo>/`, and Next
 * only prefixes its own `_next` assets with `basePath` — raw strings handed to
 * `<img>`, `fetch`, `Audio` or GLTFLoader need the prefix added by hand.
 */
export const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

export function withBase(path: string) {
  return `${basePath}${path}`;
}

/** One narration clip spoken by one voice. Clip names come from `clips.ts`;
 *  the files are written by `scripts/generate-audio.mjs`. */
export function clipUrl(voice: string, clip: string) {
  return withBase(`/audio/${voice}/${clip}`);
}

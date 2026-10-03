/**
 * Public-folder URLs. On GitHub Pages the site lives under `/<repo>/`, and Next
 * only prefixes its own `_next` assets with `basePath` — raw strings handed to
 * `<img>`, `fetch`, `Audio` or GLTFLoader need the prefix added by hand.
 */
export const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

export function withBase(path: string) {
  return `${basePath}${path}`;
}

/** Narration for an organ, or for one labelled spot on it. Written by
 *  `scripts/generate-audio.mjs`. */
export function narrationUrl(organId: string, hotspotId?: string) {
  return withBase(hotspotId ? `/audio/${organId}/${hotspotId}.mp3` : `/audio/${organId}.mp3`);
}

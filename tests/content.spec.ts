import { existsSync } from "node:fs";
import { expect, test } from "@playwright/test";
import bn from "../app/i18n/bn.json" with { type: "json" };
import { organStructures } from "../app/lib/anatomy-data";

/** Checks bn.json against the 3D data and the generated audio. No browser. */

const organs = bn.organs as Record<string, { hotspots: Record<string, unknown> }>;
const audio = (path: string) => new URL(`../public/audio/${path}`, import.meta.url);

function* strings(node: unknown, path = ""): Generator<[string, string]> {
  if (typeof node === "string") yield [path, node];
  else if (node && typeof node === "object") {
    for (const [key, value] of Object.entries(node)) yield* strings(value, path ? `${path}.${key}` : key);
  }
}

test.describe("bn.json", () => {
  test.skip(({ isMobile }) => isMobile, "data checks run once, on desktop");

  test("covers every organ and every labelled spot", () => {
    for (const organ of organStructures) {
      expect(organs[organ.id], organ.id).toBeDefined();
      for (const hotspot of organ.hotspots) {
        expect(organs[organ.id].hotspots[hotspot.id], `${organ.id}.${hotspot.id}`).toBeDefined();
      }
    }
  });

  test("is written in Bangla with Bangla numerals", () => {
    for (const [path, value] of strings(bn)) {
      // `{organ}`-style placeholders are code, not copy.
      expect(value.replace(/\{\w+\}/g, ""), path).not.toMatch(/[A-Za-z0-9]/);
    }
  });

  test("has a narration clip for every organ and spot", () => {
    for (const organ of organStructures) {
      expect(existsSync(audio(`${organ.id}.mp3`)), `${organ.id}.mp3 — run npm run audio`).toBe(true);
      for (const hotspot of organ.hotspots) {
        expect(existsSync(audio(`${organ.id}/${hotspot.id}.mp3`)), `${organ.id}/${hotspot.id}.mp3 — run npm run audio`).toBe(true);
      }
    }
  });
});

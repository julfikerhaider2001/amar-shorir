import bn from "./bn.json";
import { organStructures, type HotspotStructure, type OrganId, type OrganStructure } from "../lib/anatomy-data";

/** Every word the app shows lives in `bn.json`. Components read it through
 *  this module, so the JSON stays the single place to edit copy. */

export type OrganContent = {
  name: string;
  nickname: string;
  /** Opens with "এটা হলো …!" — read aloud together with `funFact`. */
  intro: string;
  where: string;
  size: string;
  job: string;
  daily: string;
  funFact: string;
  /** Keyed by hotspot id from `anatomy-data.ts`. */
  hotspots: Record<string, { label: string; detail: string }>;
};

type Strings = Omit<typeof bn, "organs">;

// Assigning here (rather than casting) makes TypeScript check that the JSON
// has every organ and every field.
const organContent: Record<OrganId, OrganContent> = bn.organs;
export const t: Strings = bn;

export type Hotspot = HotspotStructure & { label: string; detail: string; organId: OrganId };
export type Organ = Omit<OrganStructure, "hotspots"> & Omit<OrganContent, "hotspots"> & { hotspots: Hotspot[] };

export const organs: Organ[] = organStructures.map((structure) => {
  const content = organContent[structure.id];
  return {
    ...structure,
    ...content,
    hotspots: structure.hotspots.map((hotspot) => ({
      ...hotspot,
      organId: structure.id,
      label: content.hotspots[hotspot.id]?.label ?? "",
      detail: content.hotspots[hotspot.id]?.detail ?? "",
    })),
  };
});

export const organById = Object.fromEntries(organs.map((organ) => [organ.id, organ])) as Record<OrganId, Organ>;

/** Minimal `{name}` interpolation — the copy has no plurals or dates. */
export function format(template: string, values: Record<string, string>) {
  return template.replace(/\{(\w+)\}/g, (match, key) => values[key] ?? match);
}

const BANGLA_DIGITS = "০১২৩৪৫৬৭৮৯";

/** 42 → "৪২". Use for any number computed at runtime; copy in bn.json is
 *  already written with Bangla numerals. */
export function toBanglaDigits(value: number | string) {
  return String(value).replace(/[0-9]/g, (digit) => BANGLA_DIGITS[Number(digit)]);
}

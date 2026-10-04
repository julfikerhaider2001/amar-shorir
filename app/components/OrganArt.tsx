import type { Organ } from "../i18n";
import { withBase } from "../lib/paths";

/**
 * Renders an organ illustration, or its accent glyph for organs that ship as a
 * 3D model without the painted asset set. Keeps every image slot filled instead
 * of leaving a broken `<img>` behind.
 */
export function OrganArt({
  organ,
  asset,
  size,
}: {
  organ: Organ;
  asset: "thumb" | "organ" | "location";
  size?: number;
}) {
  if (!organ.illustrated) {
    return (
      <span className="art-fallback" style={{ "--art-accent": organ.accent } as React.CSSProperties} aria-hidden>
        {organ.icon}
      </span>
    );
  }
  return (
    <img
      key={`${organ.id}-${asset}`}
      src={withBase(`/anatomy/${organ.id}/${asset}.webp`)}
      alt=""
      width={size}
      height={size}
      loading={asset === "thumb" ? "eager" : "lazy"}
      decoding="async"
    />
  );
}

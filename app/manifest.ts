import type { MetadataRoute } from "next";
import { t } from "./i18n";
import { withBase } from "./lib/paths";

// Required for the static export (GitHub Pages and the phone apps).
export const dynamic = "force-static";

/** Lets phones "install" the website to the home screen, full screen. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: t.brand.name,
    short_name: t.brand.name,
    description: t.meta.description,
    lang: "bn",
    start_url: withBase("/"),
    scope: withBase("/"),
    display: "standalone",
    background_color: "#fff4d6",
    theme_color: "#fff4d6",
    icons: [
      { src: withBase("/icon-192.png"), sizes: "192x192", type: "image/png" },
      { src: withBase("/icon-512.png"), sizes: "512x512", type: "image/png", purpose: "any" },
    ],
  };
}

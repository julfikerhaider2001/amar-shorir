import type { NextConfig } from "next";

/**
 * GitHub Pages serves plain files from `https://<user>.github.io/<repo>/`, so
 * that build is a static export under a base path. The phone apps (Capacitor,
 * `APP_BUILD=1`) are a static export served from the root. Other targets
 * (Vercel, vinext/Cloudflare) keep the default server build at the domain root.
 */
const pages = process.env.GITHUB_PAGES === "1";
const app = process.env.APP_BUILD === "1";
const basePath = pages ? `/${process.env.PAGES_REPO ?? "amar-shorir"}` : "";

const nextConfig: NextConfig = {
  ...((pages || app) && { output: "export", trailingSlash: true }),
  basePath,
  // Exposed to client code so raw asset URLs (models, images, audio) can be
  // prefixed — Next only rewrites its own `_next` URLs.
  env: { NEXT_PUBLIC_BASE_PATH: basePath },
};

export default nextConfig;

import type { NextConfig } from "next";

/**
 * GitHub Pages serves plain files from `https://<user>.github.io/<repo>/`, so
 * that build is a static export under a base path. Other targets (Vercel,
 * vinext/Cloudflare) keep the default server build at the domain root.
 */
const pages = process.env.GITHUB_PAGES === "1";
const basePath = pages ? `/${process.env.PAGES_REPO ?? "anatomy"}` : "";

const nextConfig: NextConfig = {
  ...(pages && { output: "export", trailingSlash: true }),
  basePath,
  // Exposed to client code so raw asset URLs (models, images, audio) can be
  // prefixed — Next only rewrites its own `_next` URLs.
  env: { NEXT_PUBLIC_BASE_PATH: basePath },
};

export default nextConfig;

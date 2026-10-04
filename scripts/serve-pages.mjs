/**
 * Serves the static export in `out/` the way GitHub Pages will: under the
 * `/<repo>/` subpath, `index.html` for directories, and `404.html` for
 * anything missing. Used by `npm run preview` and the Playwright tests.
 *
 *   PORT=4173 PAGES_REPO=amar-shorir node scripts/serve-pages.mjs
 */
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { createServer } from "node:http";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const outDir = fileURLToPath(new URL("../out/", import.meta.url));
const base = `/${process.env.PAGES_REPO ?? "amar-shorir"}`;
const port = Number(process.env.PORT ?? 4173);

const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".webp": "image/webp",
  ".glb": "model/gltf-binary",
  ".mp3": "audio/mpeg",
  ".wasm": "application/wasm",
  ".woff2": "font/woff2",
  ".txt": "text/plain; charset=utf-8",
};

async function resolve(path) {
  const file = normalize(join(outDir, path));
  if (!file.startsWith(normalize(outDir))) return null;
  const info = await stat(file).catch(() => null);
  if (info?.isFile()) return file;
  if (info?.isDirectory()) return resolve(join(path, "index.html"));
  return null;
}

createServer(async (request, response) => {
  const { pathname } = new URL(request.url ?? "/", "http://localhost");
  if (pathname === "/") {
    response.writeHead(302, { location: `${base}/` }).end();
    return;
  }
  const inside = pathname === base || pathname.startsWith(`${base}/`);
  const file = inside ? await resolve(decodeURIComponent(pathname.slice(base.length))) : null;
  const target = file ?? join(outDir, "404.html");
  response.writeHead(file ? 200 : 404, { "content-type": types[extname(target)] ?? "application/octet-stream" });
  createReadStream(target).pipe(response);
}).listen(port, () => console.log(`Serving out/ at http://localhost:${port}${base}/`));

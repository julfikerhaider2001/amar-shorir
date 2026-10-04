/**
 * Offline support for the website (the phone apps carry every file already).
 *
 * - Pages: network first, so a new deploy shows up straight away; the cached
 *   copy is the fallback when there is no connection.
 * - Everything else (models, pictures, narration, scripts): served from the
 *   cache instantly and refreshed in the background.
 * - <audio> asks for byte ranges, which the Cache API can't store, so the
 *   whole file is cached and the requested slice is cut from it.
 */
const CACHE = "amar-shorir-v1";
const scope = new URL(self.registration.scope).pathname;

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.add(scope)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

async function fromNetwork(request) {
  const response = await fetch(request);
  if (response.ok && response.status === 200) {
    const cache = await caches.open(CACHE);
    await cache.put(request, response.clone());
  }
  return response;
}

async function page(request) {
  try {
    return await fromNetwork(request);
  } catch {
    return (await caches.match(request)) ?? (await caches.match(scope)) ?? Response.error();
  }
}

async function asset(request) {
  const cached = await caches.match(request);
  const fresh = fromNetwork(request);
  if (cached) {
    fresh.catch(() => {});
    return cached;
  }
  return fresh;
}

async function slice(request, response) {
  const match = /bytes=(\d*)-(\d*)/.exec(request.headers.get("range") ?? "");
  if (!match || !response.ok) return response;
  const body = await response.arrayBuffer();
  const start = Number(match[1] || 0);
  const end = match[2] ? Math.min(Number(match[2]), body.byteLength - 1) : body.byteLength - 1;
  return new Response(body.slice(start, end + 1), {
    status: 206,
    headers: {
      "content-type": response.headers.get("content-type") ?? "application/octet-stream",
      "content-range": `bytes ${start}-${end}/${body.byteLength}`,
      "content-length": String(end - start + 1),
      "accept-ranges": "bytes",
    },
  });
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin || !url.pathname.startsWith(scope)) return;

  if (request.mode === "navigate") {
    event.respondWith(page(request));
  } else if (request.headers.has("range")) {
    const whole = new Request(url.href, { credentials: request.credentials });
    event.respondWith(asset(whole).then((response) => slice(request, response)));
  } else {
    event.respondWith(asset(request));
  }
});

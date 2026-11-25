const CACHE_NAME = "heures-supplementaires-v44";
const APP_SHELL = [
  "./",
  "./index.html",
  "./index.html?v=20261124f",
  "./styles/app.css?v=20261124f",
  "./src/app.js?v=20261124f",
  "./src/translations.js?v=20261124f",
  "./src/storage.js?v=20261124f",
  "./src/utils.js?v=20261124f",
  "./manifest.webmanifest?v=20261124f",
  "./assets/fonts/inter-latin.woff2",
  "./assets/icon.svg",
  "./assets/icon-maskable.svg",
  "./assets/apple-touch-icon.png",
  "./assets/icon-192.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET" || new URL(request.url).origin !== self.location.origin) {
    return;
  }

  event.respondWith(staleWhileRevalidate(event));
});

// Answer from the cache at once so the app opens instantly even on a weak
// connection, and refresh the cached copy in the background. A new version is
// therefore picked up on the next launch rather than the current one.
async function staleWhileRevalidate(event) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(event.request);

  const network = fetch(event.request).then((response) => {
    if (response && response.ok && response.type === "basic") {
      cache.put(event.request, response.clone());
    }
    return response;
  });

  if (cached) {
    event.waitUntil(network.catch(() => {}));
    return cached;
  }

  try {
    return await network;
  } catch (error) {
    if (event.request.mode === "navigate") {
      const fallback = await cache.match("./index.html");
      if (fallback) {
        return fallback;
      }
    }
    throw error;
  }
}

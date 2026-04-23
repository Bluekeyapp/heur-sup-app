const CACHE_NAME = "heur-sup-app-v8";
const APP_SHELL = [
  "./",
  "./index.html",
  "./styles/app.css",
  "./src/app.js",
  "./src/translations.js",
  "./src/storage.js",
  "./src/utils.js",
  "./manifest.webmanifest",
  "./index.html?v=20260422g",
  "./styles/app.css?v=20260422g",
  "./src/app.js?v=20260422g",
  "./src/translations.js?v=20260422g",
  "./src/storage.js?v=20260422g",
  "./src/utils.js?v=20260422g",
  "./manifest.webmanifest?v=20260422g",
  "./assets/icon.svg",
  "./assets/icon-maskable.svg"
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
  if (event.request.method !== "GET") {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        if (!networkResponse || networkResponse.status !== 200 || networkResponse.type === "opaque") {
          return networkResponse;
        }

        const responseToCache = networkResponse.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseToCache);
        });
        return networkResponse;
      })
      .catch(() => caches.match(event.request).then((cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse;
        }

        return fetch(event.request)
        .then((networkResponse) => {
          if (!networkResponse || networkResponse.status !== 200 || networkResponse.type === "opaque") {
            return networkResponse;
          }

          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
          return networkResponse;
        });
      }))
  );
});

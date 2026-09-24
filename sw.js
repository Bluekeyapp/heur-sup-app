const CACHE_NAME = "heures-supplementaires-v37";
const APP_SHELL = [
  "./",
  "./index.html",
  "./index.html?v=20260924a",
  "./styles/app.css?v=20260924a",
  "./src/app.js?v=20260924a",
  "./src/translations.js?v=20260924a",
  "./src/storage.js?v=20260924a",
  "./src/utils.js?v=20260924a",
  "./manifest.webmanifest?v=20260924a",
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
        return cachedResponse || caches.match("./index.html");
      }))
  );
});

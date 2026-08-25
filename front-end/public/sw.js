// Golden Dragon Estate Service Worker for Chrome/Edge/Android PWA Installation
const CACHE_NAME = "golden-dragon-pwa-v1";

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  // Let network handle all requests normally
  // (PWA requirement in Chrome requires a functional fetch listener)
  event.respondWith(
    fetch(event.request).catch(() => {
      return caches.match(event.request);
    })
  );
});

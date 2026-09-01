// Golden Dragon Estate Service Worker for Chrome/Edge/Android PWA Installation
const CACHE_NAME = "golden-dragon-pwa-v2";

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // 1. NEVER intercept non-GET requests (POST, PUT, DELETE), API requests, or cross-origin backend URLs
  if (
    event.request.method !== "GET" ||
    url.pathname.startsWith("/api") ||
    url.hostname !== self.location.hostname ||
    url.href.includes("onrender.com")
  ) {
    // Return early so browser handles API calls directly with zero SW interference
    return;
  }

  // 2. For static frontend assets: network-first with safe cache fallback
  event.respondWith(
    fetch(event.request).catch(async () => {
      const cached = await caches.match(event.request);
      if (cached) return cached;
      return Response.error();
    })
  );
});

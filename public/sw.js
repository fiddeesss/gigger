// PisoQuest service worker — network-first with cache fallback.
// Fresh content matters (money app): always try the network, fall back to
// cache when offline, and cache successful GET responses opportunistically.
const CACHE = "pisoquest-v1";

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== "GET") return;
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    fetch(event.request)
      .then((res) => {
        const copy = res.clone();
        caches
          .open(CACHE)
          .then((c) => c.put(event.request, copy))
          .catch(() => {});
        return res;
      })
      .catch(() =>
        caches.match(event.request).then((m) => m || caches.match("/")),
      ),
  );
});

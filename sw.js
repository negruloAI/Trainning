const APP_VERSION = "1.5.2";
const CACHE = "mi-entrenamiento-" + APP_VERSION;
const ASSETS = [
  "./",
  "./index.html?v=" + APP_VERSION,
  "./css/style.css?v=" + APP_VERSION,
  "./js/db.js?v=" + APP_VERSION,
  "./js/app.js?v=" + APP_VERSION,
  "./manifest.webmanifest?v=" + APP_VERSION,
  "./icons/icon-192.png?v=" + APP_VERSION,
  "./icons/icon-512.png?v=" + APP_VERSION,
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)));
  self.skipWaiting();
});

// Aplicar nueva versión inmediatamente cuando la app lo pide
self.addEventListener("message", (e) => {
  if (e.data && e.data.type === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Network-first: siempre intenta la versión nueva de la red;
// si no hay conexión, cae a la caché (offline).
self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.origin !== location.origin) return;

  e.respondWith(
    fetch(e.request)
      .then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(e.request, copy)).catch(() => {});
        }
        return res;
      })
      .catch(() =>
        caches.match(e.request).then((hit) => hit || caches.match("./index.html"))
      )
  );
});

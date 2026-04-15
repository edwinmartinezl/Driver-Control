/* Driver Control — Service Worker
   Estrategia:
   - install: precache del shell (HTML, manifest, íconos, CDNs críticos)
   - activate: limpia versiones viejas
   - fetch:
       * Firebase (auth + realtime db) → passthrough (nunca cachear)
       * Navegación → Network First con fallback a cache
       * Resto → Cache First con fallback a red
*/

const CACHE = "driver-control-v1";

const PRECACHE_URLS = [
  "/",
  "/index.html",
  "/manifest.json",
  "/icon-192.svg",
  "/icon-512.svg",
  // Fuente
  "https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800;900&display=swap",
  // React + Babel + Tailwind CDN
  "https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4",
  "https://cdn.jsdelivr.net/npm/react@18.3.1/umd/react.production.min.js",
  "https://cdn.jsdelivr.net/npm/react-dom@18.3.1/umd/react-dom.production.min.js",
  "https://cdn.jsdelivr.net/npm/@babel/standalone@7.25.6/babel.min.js",
  // Firebase SDK CDN
  "https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js",
  "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth-compat.js",
  "https://www.gstatic.com/firebasejs/10.12.2/firebase-database-compat.js"
];

// Dominios que NUNCA cacheamos (autenticación + datos en vivo)
const PASSTHROUGH_HOSTS = [
  "firebaseio.com",
  "identitytoolkit.googleapis.com",
  "securetoken.googleapis.com",
  "firebaseinstallations.googleapis.com",
  "accounts.google.com",
  "apis.google.com"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) =>
      // addAll falla si una sola URL falla; usamos add individualmente con catch
      Promise.all(
        PRECACHE_URLS.map((url) =>
          cache.add(url).catch((err) =>
            console.warn("[SW] no se pudo precachear:", url, err)
          )
        )
      )
    )
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Solo manejamos GET
  if (req.method !== "GET") return;

  // Passthrough para Firebase / auth
  if (PASSTHROUGH_HOSTS.some((h) => url.hostname.endsWith(h))) return;

  // Navegación (HTML): Network First con fallback a cache
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put("/index.html", copy));
          return res;
        })
        .catch(() =>
          caches.match("/index.html").then((r) => r || caches.match("/"))
        )
    );
    return;
  }

  // Resto: Cache First
  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req)
        .then((res) => {
          // Solo cacheamos respuestas válidas (evita opaque en cross-origin sin CORS)
          if (res && res.status === 200 && (res.type === "basic" || res.type === "cors")) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy));
          }
          return res;
        })
        .catch(() => cached);
    })
  );
});

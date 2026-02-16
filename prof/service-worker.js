/* aluno.san - service-worker.js (v1.0)
   Cache inteligente:
   - Cache-first: assets do app (rápido/offline)
   - Network-first: navegação HTML (pega atualização)
   - Network-only: CSV do Google Sheets (sempre atual)
*/

const CACHE_VERSION = "aluno-san-sw-2026.02.15-1"; // <- quando você quiser forçar atualização, aumente aqui
const CACHE_NAME = `${CACHE_VERSION}`;

const PRECACHE_URLS = [
  "/",
  "/index.html",
  "/prof/",
  "/prof/index.html",
  "/app.js",
  "/style.css",
  "/manifest.json",
  "/icon-192.png",
  "/icon-512.png",
];

// Instala: precache básico
self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await cache.addAll(PRECACHE_URLS.map(u => new Request(u, { cache: "reload" })));
    await self.skipWaiting();
  })());
});

// Ativa: limpa caches antigos
self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.map((k) => (k !== CACHE_NAME ? caches.delete(k) : Promise.resolve())));
    await self.clients.claim();
  })());
});

// Fetch handler
self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // 1) CSV do Google Sheets: sempre rede (não cachear)
  if (url.hostname.includes("docs.google.com") && url.pathname.includes("/spreadsheets/")) {
    event.respondWith(fetch(req, { cache: "no-store" }));
    return;
  }

  // 2) Navegação (HTML): network-first, fallback cache
  if (req.mode === "navigate") {
    event.respondWith((async () => {
      try {
        const fresh = await fetch(req);
        const cache = await caches.open(CACHE_NAME);
        cache.put(req, fresh.clone());
        return fresh;
      } catch {
        const cached = await caches.match(req);
        return cached || caches.match("/index.html");
      }
    })());
    return;
  }

  // 3) Assets estáticos: cache-first, fallback network
  event.respondWith((async () => {
    const cached = await caches.match(req);
    if (cached) return cached;

    try {
      const fresh = await fetch(req);
      const cache = await caches.open(CACHE_NAME);
      // só cacheia GET e same-origin
      if (req.method === "GET" && url.origin === self.location.origin) {
        cache.put(req, fresh.clone());
      }
      return fresh;
    } catch {
      return cached || new Response("", { status: 504, statusText: "Offline" });
    }
  })());
});

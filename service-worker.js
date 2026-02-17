/* aluno.san - service-worker.js */

const CACHE_VERSION = "aluno-san-wpa-v1.5"; // ↑ aumente sempre que alterar
const CACHE_NAME = CACHE_VERSION;
const CSV_CACHE_NAME = `${CACHE_VERSION}-csv`;

const PRECACHE_URLS = [
  "/",
  "/index.html",
  "/prof/",
  "/prof/index.html",
  "/login/",
  "/login/index.html",
  "/app.js",
  "/style.css",
  "/manifest.json",
  "/icon-192.png",
  "/icon-512.png",
];

// --- Helpers ---
function hasForceNet(req) {
  try {
    const url = new URL(req.url);
    return url.searchParams.get("forceNet") === "1";
  } catch {
    return false;
  }
}

function isGoogleSheetsCSV(url) {
  return (
    url.hostname.includes("docs.google.com") &&
    url.pathname.includes("/spreadsheets/") &&
    url.searchParams.get("output") === "csv"
  );
}

// --- Install ---
self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);

    // Precache resiliente: se algum arquivo falhar, não derruba a instalação inteira
    await Promise.all(
      PRECACHE_URLS.map(async (u) => {
        try {
          await cache.add(new Request(u, { cache: "reload" }));
        } catch (e) {
          // não quebra o install se algum asset não existir
          // (ex.: rota /login/ pode depender de deploy)
          console.warn("[SW] Precache falhou:", u, e);
        }
      })
    );

    await self.skipWaiting();
  })());
});

// --- Activate ---
self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(
      keys.map((k) => {
        // mantém apenas os caches da versão atual
        if (k === CACHE_NAME) return Promise.resolve();
        if (k === CSV_CACHE_NAME) return Promise.resolve();

        // apaga todo o resto (versões antigas)
        if (k.startsWith("aluno-san-wpa-") || k.startsWith("aluno-san-sw-")) {
          return caches.delete(k);
        }
        return caches.delete(k);
      })
    );

    await self.clients.claim();
  })());
});

// --- Fetch ---
self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);

  // 1) BYPASS TOTAL PARA API (crítico para login e Functions)
  if (url.origin === self.location.origin && url.pathname.startsWith("/api/")) {
    event.respondWith(fetch(req, { cache: "no-store" }));
    return;
  }

  // 2) Bypass manual via ?forceNet=1
  if (hasForceNet(req)) {
    event.respondWith(fetch(req, { cache: "no-store" }));
    return;
  }

  // 3) CSV do Google Sheets: stale-while-revalidate
  if (isGoogleSheetsCSV(url)) {
    event.respondWith(staleWhileRevalidate(req, CSV_CACHE_NAME));
    return;
  }

  // 4) Navegação HTML (páginas): network-first (melhor para atualizar versão)
  if (req.mode === "navigate") {
    event.respondWith(networkFirst(req, CACHE_NAME));
    return;
  }

  // 5) Assets do mesmo domínio: cache-first
  if (url.origin === self.location.origin) {
    event.respondWith(cacheFirst(req, CACHE_NAME));
    return;
  }

  // 6) Outros (CDNs etc.)
  event.respondWith(fetch(req));
});

/* =========================
   Estratégias
========================= */

async function cacheFirst(req, cacheName) {
  const cached = await caches.match(req);
  if (cached) return cached;

  const fresh = await fetch(req);
  if (fresh && fresh.ok) {
    const cache = await caches.open(cacheName);
    cache.put(req, fresh.clone());
  }
  return fresh;
}

async function networkFirst(req, cacheName) {
  try {
    const fresh = await fetch(req);
    if (fresh && fresh.ok) {
      const cache = await caches.open(cacheName);
      cache.put(req, fresh.clone());
    }
    return fresh;
  } catch {
    const cached = await caches.match(req);
    // fallback sensato
    return cached || caches.match("/index.html");
  }
}

async function staleWhileRevalidate(req, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(req);

  const fetchPromise = fetch(req, { cache: "no-store" })
    .then((fresh) => {
      if (fresh && fresh.ok) cache.put(req, fresh.clone());
      return fresh;
    })
    .catch(() => null);

  return cached || fetchPromise;
}





/* ==========================================================================
 * Vendfy — Service Worker
 * --------------------------------------------------------------------------
 * Objetivo: que la app sea INSTALABLE y que abrirla sin señal muestre una
 * pantalla propia en vez del dinosaurio del navegador.
 *
 * REGLA DE ORO — los datos del negocio NUNCA se cachean.
 * Vendfy es multiusuario y en tiempo real: operar con un catálogo cacheado
 * significa vender a precios viejos o sobre stock que ya no existe. Además,
 * en un mostrador el navegador se comparte, y cachear el HTML de una
 * pantalla con sesión deja datos del dueño anterior en disco.
 *
 *   · Navegaciones (HTML)   → SOLO red. Si falla → /offline.html
 *   · /api/* y otros orígenes → pasan directo, el SW ni los mira
 *   · /assets/* (hash de Vite) → cache-first: son inmutables
 *   · Íconos e imágenes      → stale-while-revalidate
 *
 * Al cambiar la estrategia hay que subir CACHE_VERSION: el activate borra
 * todas las cachés que no coincidan.
 * ======================================================================== */

const CACHE_VERSION = "vendfy-v1";
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const ASSET_CACHE = `${CACHE_VERSION}-assets`;

const OFFLINE_URL = "/offline.html";

const PRECACHE = [
  OFFLINE_URL,
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/apple-touch-icon.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) =>
      // Uno por uno y no addAll: addAll es atómico y un solo 404 dejaría la
      // app entera sin service worker.
      Promise.all(
        PRECACHE.map((url) =>
          cache.add(new Request(url, { cache: "reload" })).catch(() => {}),
        ),
      ),
    ),
  );
  // Sin skipWaiting(): la versión nueva espera a que el usuario acepte el
  // aviso de actualización (ver el mensaje SKIP_WAITING abajo).
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((k) => k !== STATIC_CACHE && k !== ASSET_CACHE)
          .map((k) => caches.delete(k)),
      );
      // Mientras el SW despierta, el navegador ya va pidiendo el HTML.
      if (self.registration.navigationPreload) {
        await self.registration.navigationPreload.enable();
      }
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;

  // Mutaciones (POST a /api, subidas de imágenes) → jamás por el SW.
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // Otros orígenes: la API, Supabase Storage, fuentes. Pasan tal cual.
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return;

  // --- 1. Navegaciones: solo red, con respaldo offline -------------------
  // La respuesta NO se cachea: es HTML con sesión.
  if (request.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          const preloaded = await event.preloadResponse;
          if (preloaded) return preloaded;
          return await fetch(request);
        } catch {
          const cache = await caches.open(STATIC_CACHE);
          const offline = await cache.match(OFFLINE_URL);
          return (
            offline ??
            new Response(
              "<h1>Sin conexión</h1><p>Volvé a intentarlo cuando tengas internet.</p>",
              {
                headers: { "Content-Type": "text/html; charset=utf-8" },
                status: 503,
              },
            )
          );
        }
      })(),
    );
    return;
  }

  // --- 2. Bundles de Vite: cache-first ------------------------------------
  // El nombre lleva el hash del contenido, así que un acierto siempre es
  // válido; en cada despliegue cambian los nombres y se piden de red.
  if (url.pathname.startsWith("/assets/")) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(request).then((res) => {
            if (res.ok) {
              const copy = res.clone();
              caches.open(STATIC_CACHE).then((c) => c.put(request, copy));
            }
            return res;
          }),
      ),
    );
    return;
  }

  // --- 3. Íconos e imágenes: stale-while-revalidate -----------------------
  if (/\.(png|jpg|jpeg|svg|webp|ico|woff2?)$/i.test(url.pathname)) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(ASSET_CACHE);
        const cached = await cache.match(request);
        const network = fetch(request)
          .then((res) => {
            if (res.ok) cache.put(request, res.clone());
            return res;
          })
          .catch(() => cached);
        return cached || network;
      })(),
    );
    return;
  }

  // El resto: red directa.
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") self.skipWaiting();

  // Al cerrar sesión se vacía todo por higiene: deja el equipo limpio para
  // el siguiente usuario del mismo navegador.
  if (event.data?.type === "CLEAR_CACHES") {
    event.waitUntil(
      caches
        .keys()
        .then((keys) => Promise.all(keys.map((k) => caches.delete(k)))),
    );
  }
});

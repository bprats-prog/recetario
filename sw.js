const CACHE_NAME = "recetario-shell-v2";
const SHELL_FILES = ["/manifest.json", "/icon-192.png", "/icon-512.png", "/apple-touch-icon.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_FILES)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(names.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  // Never cache calls to the Supabase edge function: that data must stay live.
  if (url.hostname.endsWith("supabase.co")) return;

  // Network-first for the HTML shell and the recipe data, so a new deploy
  // shows up immediately instead of being stuck behind a stale cache; only
  // fall back to the cached copy when actually offline.
  const isHtmlShell = req.mode === "navigate" || url.pathname === "/" || url.pathname.endsWith("index.html");
  const isRecipesData = url.pathname.endsWith("recipes.json");
  if (isHtmlShell || isRecipesData) {
    event.respondWith(
      fetch(req).then((res) => {
        const copy = res.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
        return res;
      }).catch(() => caches.match(req))
    );
    return;
  }

  // Cache-first for the rest of the static shell (icons, manifest, recipe pages).
  event.respondWith(
    caches.match(req).then((cached) => cached || fetch(req).then((res) => {
      const copy = res.clone();
      caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
      return res;
    }))
  );
});

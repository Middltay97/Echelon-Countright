// CountRight service worker.
// Goals:
//  - Make the mobile counter (/m) usable when wifi drops mid-session.
//  - Satisfy PWA install / Trusted Web Activity (TWA) requirements so the app
//    can be wrapped with Bubblewrap and shipped to Google Play.
//
// Strategy:
//  - Never cache HTML or hashed JS chunks. Mobile WebViews can otherwise keep
//    an old app shell that points at deleted chunks after a publish.
//  - Keep only install metadata/icons cached for PWA requirements.
//  - Supabase API calls and edge functions: always go to the network — never
//    cache (writes must not be silently swallowed; reads must be fresh).

const VERSION = "v7";
const SHELL_CACHE = `cr-shell-${VERSION}`;

const PRECACHE_URLS = ["/manifest.webmanifest", "/icon-192.png", "/icon-512-maskable.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(SHELL_CACHE);
      // Best-effort precache: don't fail install if any single URL 404s.
      await Promise.all(
        PRECACHE_URLS.map((u) =>
          fetch(u, { cache: "no-store" })
            .then((r) => (r.ok ? cache.put(u, r) : null))
            .catch(() => null),
        ),
      );
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== SHELL_CACHE).map((k) => caches.delete(k)));
      await self.clients.claim();
    })(),
  );
});

function isStaticAsset(url) {
  return (
    url.pathname.startsWith("/_build/") ||
    url.pathname.startsWith("/assets/") ||
    /\.(?:js|css|woff2?|ttf|otf|png|jpg|jpeg|webp|svg|ico)$/i.test(url.pathname)
  );
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);

  // Only handle our own origin. Supabase, edge functions, and any third-party
  // requests pass straight through to the network.
  if (url.origin !== self.location.origin) return;

  // Never intercept Supabase REST or auth.
  if (url.pathname.startsWith("/auth/") || url.pathname.startsWith("/rest/")) {
    return;
  }

  // HTML navigations: always network. A cached /m shell is the root cause of
  // stale dynamic-import failures on scanners after a publish.
  if (req.mode === "navigate") {
    event.respondWith(fetch(req, { cache: "no-store" }));
    return;
  }

  // Static assets: network-only. Never cache hashed JS chunks; stale chunks are
  // what strand scanners on "failed to fetch dynamically imported module".
  if (isStaticAsset(url)) {
    event.respondWith(fetch(req));
  }
});

// Allow the page to ask the SW to update immediately after a deploy.
self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") self.skipWaiting();
});

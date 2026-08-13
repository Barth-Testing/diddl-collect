/* Knuddelblätter Service Worker – Version wird beim Build automatisch generiert */
const VERSION = "vb8ea69cd";
const PRECACHE = "knuddel-pre-" + VERSION;
const RUNTIME = "knuddel-run-" + VERSION;
const PRECACHE_URLS = [
  "/",
  "/katalog",
  "/konto",
  "/rangliste",
  "/404.html",
  "/manifest.webmanifest",
  "/icon-192.png",
  "/icon-512.png",
  "/_next/static/chunks/0cz1d0mv5g_q7.js",
  "/_next/static/chunks/0jvhpaew_uadu.js",
  "/_next/static/chunks/17ry0w_olyile.css",
  "/_next/static/chunks/19mx3mg6lkumu.js",
  "/_next/static/chunks/1l1977o29aoeh.js",
  "/_next/static/chunks/1z8n0o3vmumim.js",
  "/_next/static/chunks/2gnezgif7n3z9.js",
  "/_next/static/chunks/308_fqt2e0z8t.js",
  "/_next/static/chunks/33lvy7m3xh_8r.js",
  "/_next/static/chunks/36lm--m0zwqtj.js",
  "/_next/static/chunks/3qhgxk_gn4sso.js",
  "/_next/static/chunks/3x9_5ffomdu8y.js",
  "/_next/static/chunks/3zgd8ube1f6b9.js",
  "/_next/static/chunks/turbopack-11l2ltthn31mr.js",
  "/_next/static/j1tiv3LbL1YD7juI0G-VS/_buildManifest.js",
  "/_next/static/j1tiv3LbL1YD7juI0G-VS/_clientMiddlewareManifest.js",
  "/_next/static/j1tiv3LbL1YD7juI0G-VS/_ssgManifest.js",
  "/_next/static/media/07454f8ad8aaac57-s.p.2kjei9psvcorz.woff2",
  "/_next/static/media/0781808e3393dbfb-s.3uuzd4ky6sm1t.woff2",
  "/_next/static/media/224e262ef877bfa4-s.1zkvd_innyig_.woff2",
  "/_next/static/media/4a7551bcc3548e67-s.p.3jc5sq-923m_s.woff2",
  "/_next/static/media/7f11d98043fdedc9-s.2c8-7nzo1jf9r.woff2",
  "/_next/static/media/d8cb5ab3660140cd-s.2demiz2t05dx4.woff2",
  "/_next/static/media/e6d00ff86ef9e699-s.1vcas2uk12q5a.woff2",
  "/_next/static/media/fae90444fefcda8c-s.403cfnf7b-1vb.woff2"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(PRECACHE).then((cache) => cache.addAll(PRECACHE_URLS)).then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => !k.startsWith(PRECACHE) && !k.startsWith(RUNTIME)).map((k) => caches.delete(k))),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);

  /* Analytics nicht cachen (immer live) */
  if (url.hostname.endsWith("googletagmanager.com") || url.hostname.endsWith("google-analytics.com")) {
    return;
  }

  /* Diddl-Bilder: erst Cache, im Hintergrund aktualisieren (Offline-Tauglich) */
  if (url.hostname.endsWith("diddl-exchange.de")) {
    event.respondWith(
      caches.match(req).then((hit) => {
        const update = fetch(req).then((res) => {
          if (res.ok) caches.open(RUNTIME).then((c) => c.put(req, res.clone()));
          return res;
        });
        return hit || update;
      }),
    );
    return;
  }

  /* Gehashte Next.js-Assets: immutable, cache-first */
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(
      caches.match(req).then(
        (hit) => hit || fetch(req).then((res) => {
          const copy = res.clone();
          caches.open(RUNTIME).then((c) => c.put(req, copy));
          return res;
        }),
      ),
    );
    return;
  }

  /* Navigation: network-first, offline aus dem Cache (auch mit .html) */
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(PRECACHE).then((c) => c.put(req, copy));
          return res;
        })
        .catch(() =>
          caches.match(req).then(
            (hit) => hit || caches.match(url.pathname + ".html").then((h) => h || caches.match("/")),
          ),
        ),
    );
    return;
  }

  /* Rest (manifest, Icons, …): cache-first mit Fallback ins Netz */
  event.respondWith(
    caches.match(req).then(
      (hit) => hit || fetch(req).then((res) => {
        const copy = res.clone();
        caches.open(RUNTIME).then((c) => c.put(req, copy));
        return res;
      }),
    ),
  );
});
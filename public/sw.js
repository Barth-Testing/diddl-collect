/* Knuddelblätter Service Worker – Version wird beim Build automatisch generiert */
const VERSION = "vd287cc6c";
const PRECACHE = "knuddel-pre-" + VERSION;
const RUNTIME = "knuddel-run-" + VERSION;
const PRECACHE_URLS = [
  "/_next/static/Gsje49LXJKMf9E0vHerzn/_buildManifest.js",
  "/_next/static/Gsje49LXJKMf9E0vHerzn/_clientMiddlewareManifest.js",
  "/_next/static/Gsje49LXJKMf9E0vHerzn/_ssgManifest.js",
  "/_next/static/chunks/04ittye2u-_86.js",
  "/_next/static/chunks/0cz1d0mv5g_q7.js",
  "/_next/static/chunks/0ica6qvfwe_-3.js",
  "/_next/static/chunks/0jvhpaew_uadu.js",
  "/_next/static/chunks/19mx3mg6lkumu.js",
  "/_next/static/chunks/1c1o1y2e2jihl.js",
  "/_next/static/chunks/1g-aqf2-wakqd.js",
  "/_next/static/chunks/1g2ikdnw-8tu4.js",
  "/_next/static/chunks/1y9ulk0oo3wwt.js",
  "/_next/static/chunks/20a0w82oovf5o.js",
  "/_next/static/chunks/2b8m0froc9y7h.js",
  "/_next/static/chunks/2lpf06npnxjlb.js",
  "/_next/static/chunks/2osv-gnrgzp4c.js",
  "/_next/static/chunks/2v2sekfzyol6f.js",
  "/_next/static/chunks/2ye8mi3kmbnhi.js",
  "/_next/static/chunks/30ouips1_c7us.js",
  "/_next/static/chunks/34ol7h_s7kmfb.js",
  "/_next/static/chunks/36lm--m0zwqtj.js",
  "/_next/static/chunks/3gxp0qj-25k-8.js",
  "/_next/static/chunks/3mgvmpdnm18tu.css",
  "/_next/static/chunks/3tcog6nkeugog.js",
  "/_next/static/chunks/3zgd8ube1f6b9.js",
  "/_next/static/chunks/turbopack-22-s-9frl7x1b.js",
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

  /* API-Aufrufe (Supabase u. a.) NIE cachen – immer live.
     Sonst liefert ein Browser-Refresh veraltete Sammlungsdaten aus dem
     Runtime-Cache, während Login/Upload (POST) korrekt live sind. */
  if (url.origin !== self.location.origin && !url.hostname.endsWith("diddl-exchange.de")) {
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
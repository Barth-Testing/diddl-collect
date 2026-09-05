/* Knuddelblätter Service Worker – Version wird beim Build automatisch generiert */
const VERSION = "v00de3ea4";
const PRECACHE = "knuddel-pre-" + VERSION;
const RUNTIME = "knuddel-run-" + VERSION;
const PRECACHE_URLS = [
  "/_next/static/RC7bmOWdLbecu6nFL6GKy/_buildManifest.js",
  "/_next/static/RC7bmOWdLbecu6nFL6GKy/_clientMiddlewareManifest.js",
  "/_next/static/RC7bmOWdLbecu6nFL6GKy/_ssgManifest.js",
  "/_next/static/chunks/09gancv5qaapm.js",
  "/_next/static/chunks/0cz1d0mv5g_q7.js",
  "/_next/static/chunks/0fk74ezekkqax.js",
  "/_next/static/chunks/0jvhpaew_uadu.js",
  "/_next/static/chunks/19mx3mg6lkumu.js",
  "/_next/static/chunks/1h4q8jsg6lak-.js",
  "/_next/static/chunks/1i5c_p_-auy0b.js",
  "/_next/static/chunks/1w9-yraz3-omb.js",
  "/_next/static/chunks/1y06mxdejrk3l.js",
  "/_next/static/chunks/2b8m0froc9y7h.js",
  "/_next/static/chunks/2osv-gnrgzp4c.js",
  "/_next/static/chunks/2y5ns0fnp24ib.js",
  "/_next/static/chunks/2zo1toppmyq3-.css",
  "/_next/static/chunks/35r31o2a4_7q8.js",
  "/_next/static/chunks/36lm--m0zwqtj.js",
  "/_next/static/chunks/38lg0--wh-keh.js",
  "/_next/static/chunks/3ayxudn1ei3iz.js",
  "/_next/static/chunks/3b7-pcf5gwyc-.js",
  "/_next/static/chunks/3tcog6nkeugog.js",
  "/_next/static/chunks/3yp2ehg9t7vtp.js",
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
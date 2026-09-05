# Diddl Collect — Working Instructions

> ## ⚠️ LIVE PRODUCTION — READ FIRST
> This project is **already deployed and live** with **real production users** who depend on it daily. The app must keep working while you adapt or implement features.
>
> ### Non-negotiable guardrails
> 1. **Never break the existing live app.** Every change — even refactors, redesigns, or dependency updates — must be backwards-compatible and must not regress current functionality.
> 2. **Deploy incrementally, not atomically.** Ship changes in small, safe steps. Verify each step before moving on. Do not restructure large parts of the app in one shot.
> 3. **No breaking data changes.** Existing user accounts, collections, wishlists, and exchange listings must survive any schema or code change. Migrations must be non-destructive and reversible.
> 4. **Protect user data.** Never delete, overwrite, or expose user data (Supabase-backed). Treat .env.local and secrets as untouchable.
> 5. **Verify before finishing.** After any change run `npm run lint` and `npm run build`; if something cannot be verified locally, say so explicitly instead of assuming it works.
> 6. **If in doubt, ask.** When a change could affect live users, ask the user before proceeding rather than guessing.

## Git / Deploy / Credentials

- Remote: `https://github.com/Barth-Testing/diddl-collect.git` (branch `main`). Push to main triggers an automatic Cloudflare Pages deploy (~2 min).
- **The `gh` CLI token is expired/invalid** (`~/.config/gh/hosts.yml`) — do NOT rely on `gh` for auth; a push via gh helper fails with "could not read Username".
- Working credentials for account **Barth-Testing**:
  - `/home/toni/opencode_projects/github/barth_testing_credentials.md` — line 1 = username, line 2 = valid PAT (scopes: repo, workflow).
  - `~/.git-credentials` contains that token in store format; repo-local `credential.helper=store` is configured → plain `git push origin main` works.
- `/home/toni/opencode_projects/github/gamerparktv_credentials.md` + SSH key `~/.ssh/gamerparktv_github` belong to account **GamerParkTV** — authenticates fine but has **no permission on this repo** ("denied to GamerParkTV"). The SSH key `github/ssh_barth_testing/barth-testing` is currently rejected by GitHub.
- Never commit junk like `*:Zone.Identifier` files or stray root-level duplicates of assets that already exist under `public/`.

## Supabase

- Env: `.env.local` with `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY` (never print values). `getSupabase()` returns null when unconfigured — the app then runs local-only.
- Tables: `profile` (id, name, passwort [bcrypt, früher SHA-256], created_at, statuses jsonb, beweise jsonb, favoriten jsonb, tausch jsonb, email [privat]), `sitzungen` (Session-Tokens: token_hash, benutzer_id, ablauf), `news`, `nachrichten` (forum/chat), `tauschangebot`, `postnachrichten`.
- **Konto & Sicherheit (seit 30.08.2026):** Kein direkter Schreibzugriff mehr über die API – `anon` hat nur noch SELECT. Login/Registrierung und ALLE Schreibvorgänge laufen über `security definer`-RPCs mit Session-Token (`scripts/konto-haertung.sql`): `anmelden`, `registrieren`, `profil_schreiben`, `beweis_hochladen`/`beweis_loeschen`, `angebot_anlegen`/`angebot_status`, `post_senden`, `forum_posten`, `passwort_aendern`, `email_setzen`/`email_entfernen`/`lese_eigene_email`, `abmelden`. **Namen/Autoren werden serverseitig aus dem Token-Konto gesetzt** – nie vom Client übernehmen (sonst Spoofing). Fehlercode `28000` = Session ungültig (App loggt die Session aus), `23505` = doppelt, `23514` = Validierung, `42501` = nicht dein Angebot. **Achtung Lese-Rechte:** Column-Level-Grants! `profile.blocks`/`profile.anzahl` waren zeitweise für anon gesperrt (`42501` auf SELECT → gesamter Sync lief ins Leere, nur Login-RPC lieferte Daten). Fix: `scripts/lese-rechte-fix.sql`. `istSchemaFehler` behandelt `42501` als "Spalte entfernen & retry" – nicht still schlucken!
- `profile.email` ist **privat**: `revoke select(email)` für anon; der Besitzer liest sie via `lese_eigene_email`, der Betreiber nur im Dashboard.
- Schema changes are applied **manually by the user in the Supabase SQL editor** — hand them ready-to-run SQL statements. Deploys can go live BEFORE the SQL runs, so any new column/function needs a graceful fallback in code (catch `PGRST204`/`42703`, `PGRST202` für fehlende Funktionen → alter Weg; siehe `favoritenUnterstuetzt` in store.ts, PGRST202-Fallbacks in login/register).

## Store sync rules (src/lib/store.ts)

- All profiles are synced server-side into a localStorage cache; components re-render via `useStoreVersion()`.
- `statuses` is now `Record<string, Status[]>` (multi-select: own/wish/offer parallel, z. B. own+offer). Legacy single-string values are normalized via `normalisiereStatus(es)` in types.ts (old `"offer"` ⇒ `["own","offer"]`). ALWAYS normalize on read paths (loadUsers, zeileZuBenutzer) — never compare `=== "own"` directly; use `.includes()`. Backend jsonb column stays unchanged (no SQL migration needed).
- Adding ANY field to `Benutzer` requires ALL of: optional in `ProfileRow`, normalize old caches in `loadUsers` (`?? {}`), map it in `zeileZuBenutzer`, set it in `register()`, merge + change-compare it in `syncMitServer`, include it in `pushProfil`. Missing one causes silent data loss or TS errors.
- **Blatt-IDs in Nutzerdaten sind FREIGESCHALTET (Remap bei jedem Lese-Pfad).** Die 12 alten Sammelverzeichnis-IDs (`A5-463` … `A6-234`, am 27.08.2026 auf `diddlback-de-*` umgezogen) stehen in `ALTE_BLATT_IDS` (types.ts); `normalisiereStatuses` + `remappeBlattSchluessel` mappen statuses/beweise/favoriten/tausch beim Laden. Die SQL-Migration `scripts/didlback-id-migration.sql` zieht auch die DB um. **NIEMALS Katalog-Blätter umbenennen/umbetten** – ein ID-Wechsel macht alle Nutzer-Markierungen (und Tausch-Offerten) unsichtbar. Neue Blätter bekommen neue IDs, alte bleiben stabil.

## Catalog data pipeline

- `npm run fetch:katalog` REGENERATES `blaetter.json` from diddl-exchange.de only — it wipes manually added entries (e.g. sammelverzeichnis sheets). Don't run it casually.
- `npm run fetch:sammelverzeichnis` merges "Diddl is back" sheets from diddl-sammelverzeichnis.de into `blaetter.json` (merge by id; numbering continues per size A4→A5→A6). Uses `pngjs` for dominant-color analysis (the jwwb CDN ignores `fm=jpg`, always serves PNG).
- `blaetter.json` is COMPACT JSON (no pretty-printing) — keep that format when rewriting.
- The catalog year filter defaults matter: extend the `JAHRE` range and the `jahrBis` default in KatalogApp.tsx whenever adding newer years, otherwise new sheets are invisible even though present in data.

## Tausch (src/lib/tausch.ts)

- Thread-Cache liegt in EINEM atomaren localStorage-Key `diddlcollect:tausch` (Mutationen laufen via `serialisiere()`-Mutex, async Teile wie `ladeAlles` rufen `flushQueueInnere()` direkt auf – kein Re-Entry in den Lock). Alte Zwei-Key-Caches (`diddlcollect:tauschangebote` / `diddlcollect:post`) werden beim Lesen migriert und beim Schreiben gelöscht.
- `markiereGelesen` darf **kein** unbedingtes `emitChange()` abfeuern (Verstärker-Schleife mit `PostfachApp` → Freeze); Änderungen erst nach >5s emittieren.
- Thread-Ansicht ist für BEIDE Parteien dieselbe: `AngebotVorschau` zeigt gewünschtes Blatt + gebotene Blätter + Betrag + Freitext. Es gibt keinen „Annehmen“-Button (könnte falsche Ansprüche ableiten), nur antworten / Ablehnen / Stornieren.



- >100 own sheets with <100 proofs ⇒ capped at exactly **100 points**, ranked normally inline (field `punkte`); ≥100 proofs unlock full points. Implemented in `berechneRangliste()`.

## Build / PWA quirks

- Static export: routes land as `out/<route>.html` (no trailing slash). Verify shipped content by grepping `out/*.html`.
- Postbuild regenerates `public/sw.js` + `out/sw.js` with a content-hash version caching `_next/static` assets — after a deploy users may need one extra reload until the SW updates.
- PWA installability: manifest.webmanifest + icon-192/512 exist in `public/`; the visible entry point is the `AppInstallieren` header button (beforeinstallprompt on Android/desktop, iOS shows a "Zum Home-Bildschirm" hint).

## Conventions

- No code comments unless asked.
- UI text entirely German (Diddl-blätter collecting community).
- Custom Tailwind color tokens: candy, berry, peach, mint, cream, ink (defined in globals.css) — use them instead of raw palettes where they fit.
- Reuse shared components instead of duplicating: `SelectBasis`, `Punkte`, `SammlerKarussell` (modes vorlage/beweis/favoriten), `BlattKarte` (status rings, `bildOverride`, `favorit` gold outline + star).
- `<img>` is used throughout; the `no-img-element` lint warning is accepted noise (only fix real errors).
- Don't violate Diddl copyright: hotlink third-party catalog images, don't download/reproduce original artwork.

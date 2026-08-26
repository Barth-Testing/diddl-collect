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
- Tables: `profile` (id, name, passwort [hashed], created_at, statuses jsonb, beweise jsonb, favoriten jsonb), `news` (id, titel, text, erstellt_am, bild), `nachrichten` (forum/chat).
- Schema changes are applied **manually by the user in the Supabase SQL editor** — hand them ready-to-run SQL statements. Deploys can go live BEFORE the SQL runs, so any new column needs a graceful fallback in code (catch error codes `PGRST204`/`42703`, retry the query without the new column — see `favoritenUnterstuetzt` in store.ts, news `bild` fallback in Neuigkeiten.tsx).

## Store sync rules (src/lib/store.ts)

- All profiles are synced server-side into a localStorage cache; components re-render via `useStoreVersion()`.
- `statuses` is now `Record<string, Status[]>` (multi-select: own/wish/offer parallel, z. B. own+offer). Legacy single-string values are normalized via `normalisiereStatus(es)` in types.ts (old `"offer"` ⇒ `["own","offer"]`). ALWAYS normalize on read paths (loadUsers, zeileZuBenutzer) — never compare `=== "own"` directly; use `.includes()`. Backend jsonb column stays unchanged (no SQL migration needed).
- Adding ANY field to `Benutzer` requires ALL of: optional in `ProfileRow`, normalize old caches in `loadUsers` (`?? {}`), map it in `zeileZuBenutzer`, set it in `register()`, merge + change-compare it in `syncMitServer`, include it in `pushProfil`. Missing one causes silent data loss or TS errors.

## Catalog data pipeline

- `npm run fetch:katalog` REGENERATES `blaetter.json` from diddl-exchange.de only — it wipes manually added entries (e.g. sammelverzeichnis sheets). Don't run it casually.
- `npm run fetch:sammelverzeichnis` merges "Diddl is back" sheets from diddl-sammelverzeichnis.de into `blaetter.json` (merge by id; numbering continues per size A4→A5→A6). Uses `pngjs` for dominant-color analysis (the jwwb CDN ignores `fm=jpg`, always serves PNG).
- `blaetter.json` is COMPACT JSON (no pretty-printing) — keep that format when rewriting.
- The catalog year filter defaults matter: extend the `JAHRE` range and the `jahrBis` default in KatalogApp.tsx whenever adding newer years, otherwise new sheets are invisible even though present in data.

## Ranking rule

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

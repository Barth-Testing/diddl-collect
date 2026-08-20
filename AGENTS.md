# Diddl Collect — Working Instructions

> ## ⚠️ LIVE PRODUCTION — READ FIRST
> This project is **already deployed and live** with **real production users** who depend on it daily. The app must keep working while you adapt or implement features.
>
> ### Non-negotiable guardrails
> 1. **Never break the existing live app.** Every change — even refactors, redesigns, or dependency updates — must be backwards-compatible and must not regress current functionality.
> 2. **Deploy incrementally, not atomically.** Ship changes in small, safe steps. Verify each step before moving on. Do not restructure large parts of the app in one shot.
> 3. **No breaking data changes.** Existing user accounts, collections, wishlists, and exchange listings must survive any schema or code change. Migrations must be non-destructive and reversible.
> 4. **Protect user data.** Never delete, overwrite, or expose user data (Supabase-backed). Treat .env.local and secrets as untouchable.
> 5. **Verify before finishing.** After any change run the checks below; if something cannot be verified locally, say so explicitly instead of assuming it works.
> 6. **If in doubt, ask.** When a change could affect live users, ask the user before proceeding rather than guessing.

## Verification commands

```bash
npm run lint    # lint
npm run build   # build (also runs postbuild -> scripts/build-sw.mjs)
```

## Project facts

- Next.js 16 app (App Router) with React 19, TypeScript, Tailwind CSS v4
- Supabase (PostgreSQL) backend via `@supabase/supabase-js`
- Static export to `out/` and deployed (Cloudflare Pages)
- PWA/service worker built by `scripts/build-sw.mjs` during postbuild
- Catalog data fetched via `npm run fetch:katalog` (scripts/fetch-katalog.mjs)
- UI text is entirely German (Diddl-blätter collecting community)
- Don't violate Diddl copyright (original Diddl artwork must not be reproduced)

## Conventions

- No code comments unless asked.
- Mimic existing file style and patterns; reuse existing components/utilities (clsx, tailwind-merge, lucide-react).
- Always check AGENTS.md first on every session — this file is the standing instruction set.

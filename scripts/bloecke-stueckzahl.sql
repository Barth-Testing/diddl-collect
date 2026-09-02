-- Diddl-Collect: Block-Besitz + Stückzahl je Blatt
-- ==================================================
-- Neue Optionen je Blatt in der Sammlung:
--   * "Block besessen"   -> profile.blocks  (jsonb: blatt_id -> true)
--   * "Stückzahl / Mehrfach-Exemplare" -> profile.anzahl (jsonb: blatt_id -> Zahl)
--
-- Einmalig im Supabase SQL Editor ausführen: Dashboard → SQL Editor → New query → Run.
-- Idempotent (add column if not exists; create or replace). Bestehende Daten bleiben erhalten.

alter table public.profile add column if not exists blocks jsonb not null default '{}'::jsonb;
alter table public.profile add column if not exists anzahl jsonb not null default '{}'::jsonb;

-- Login/Registrierung liefern das Profil inkl. neuer Felder.
create or replace function public.profil_json(p_zeile public.profile)
returns json
language sql immutable set search_path = public, extensions
as $$
  select json_build_object(
    'id', p_zeile.id,
    'name', p_zeile.name,
    'created_at', p_zeile.created_at,
    'statuses', p_zeile.statuses,
    'beweise', p_zeile.beweise,
    'favoriten', coalesce(p_zeile.favoriten, '{}'::jsonb),
    'tausch', coalesce(p_zeile.tausch, '{}'::jsonb),
    'blocks', coalesce(p_zeile.blocks, '{}'::jsonb),
    'anzahl', coalesce(p_zeile.anzahl, '{}'::jsonb)
  );
$$;

-- Schreibfunktion erweitern – die neuen Parameter sind optional (default null),
-- damit ältere App-Versionen weiter funktionieren.
create or replace function public.profil_schreiben(
  p_token text,
  p_statuses jsonb,
  p_beweise jsonb,
  p_favoriten jsonb,
  p_tausch jsonb,
  p_blocks jsonb default null,
  p_anzahl jsonb default null
)
returns void
language plpgsql security definer set search_path = public, extensions
as $$
declare
  benutzer_id text := public.sitzung_benutzer(p_token);
begin
  if benutzer_id is null then
    raise exception 'Sitzung abgelaufen – bitte neu anmelden.' using errcode = '28000';
  end if;
  update public.profile
     set statuses = coalesce(p_statuses, statuses),
         beweise = coalesce(p_beweise, beweise),
         favoriten = coalesce(p_favoriten, favoriten),
         tausch = coalesce(p_tausch, tausch),
         blocks = coalesce(p_blocks, blocks),
         anzahl = coalesce(p_anzahl, anzahl)
   where id = benutzer_id;
end $$;

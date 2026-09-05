-- Diddl-Collect: Atomarer Profil-Patch (Multi-Device-sicher)
-- =====================================================
-- Problem: profil_schreiben überschreibt die KOMPLETTEN jsonb-Spalten
-- (statuses/beweise/favoriten/tausch/blocks/anzahl). Wenn zwei Geräte
-- gleichzeitig je einen anderen Schlüssel ändern (z. B. Handy markiert
-- Blatt 1, PC markiert Blatt 2 auf Basis desselben alten Stands), gewinnt
-- der letzte Upload komplett – die Änderung des anderen Geräts geht verloren.
--
-- Lösung: profil_patch nimmt NUR die lokal geänderten (dirty) Schlüssel plus
-- die gelöschten Schlüssel und wendet sie ATOMAR in einem einzigen UPDATE an:
--   Spalte = (Spalte || gesetzte_Schlüssel) - gelöschte_Schlüssel
-- Unterschiedliche Schlüssel auf verschiedenen Geräten kollidieren damit nie
-- mehr; nur derselbe Schlüssel zur selben Zeit bleibt Last-Writer-Wins.
--
-- Einmalig im Supabase SQL Editor ausführen: Dashboard → SQL Editor →
-- New query → Run. Idempotent (create or replace). Alte App-Versionen nutzen
-- weiter profil_schreiben (bleibt erhalten); neue App nutzt profil_patch mit
-- automatischem Fallback auf profil_schreiben, falls diese Datei noch nicht
-- ausgeführt wurde. Deploys können also VOR dem SQL-Update live gehen.
--
-- Enthält außerdem profil_json inkl. blocks/anzahl (idempotent), falls
-- scripts/bloecke-stueckzahl.sql noch nicht gelaufen ist.

-- Login/Registrierung/Patch-Antwort liefern das Profil inkl. neuer Felder.
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

-- Atomarer Teil-Upload: nur dirty Schlüssel setzen, gelöschte entfernen.
-- Leere/NULL-Parameter sind No-ops. Liefert {profil: ...} wie anmelden.
create or replace function public.profil_patch(
  p_token text,
  p_statuses jsonb default null,
  p_statuses_loesch text[] default null,
  p_beweise jsonb default null,
  p_beweise_loesch text[] default null,
  p_favoriten jsonb default null,
  p_favoriten_loesch text[] default null,
  p_tausch jsonb default null,
  p_tausch_loesch text[] default null,
  p_blocks jsonb default null,
  p_blocks_loesch text[] default null,
  p_anzahl jsonb default null,
  p_anzahl_loesch text[] default null
)
returns json
language plpgsql security definer set search_path = public, extensions
as $$
declare
  benutzer_id text := public.sitzung_benutzer(p_token);
  zeile public.profile%rowtype;
begin
  if benutzer_id is null then
    raise exception 'Sitzung abgelaufen – bitte neu anmelden.' using errcode = '28000';
  end if;
  update public.profile
     set statuses = ((coalesce(statuses, '{}'::jsonb) || coalesce(p_statuses, '{}'::jsonb)) - coalesce(p_statuses_loesch, '{}')),
         beweise = ((coalesce(beweise, '{}'::jsonb) || coalesce(p_beweise, '{}'::jsonb)) - coalesce(p_beweise_loesch, '{}')),
         favoriten = ((coalesce(favoriten, '{}'::jsonb) || coalesce(p_favoriten, '{}'::jsonb)) - coalesce(p_favoriten_loesch, '{}')),
         tausch = ((coalesce(tausch, '{}'::jsonb) || coalesce(p_tausch, '{}'::jsonb)) - coalesce(p_tausch_loesch, '{}')),
         blocks = ((coalesce(blocks, '{}'::jsonb) || coalesce(p_blocks, '{}'::jsonb)) - coalesce(p_blocks_loesch, '{}')),
         anzahl = ((coalesce(anzahl, '{}'::jsonb) || coalesce(p_anzahl, '{}'::jsonb)) - coalesce(p_anzahl_loesch, '{}'))
   where id = benutzer_id
  returning * into zeile;
  return json_build_object('profil', public.profil_json(zeile));
end $$;

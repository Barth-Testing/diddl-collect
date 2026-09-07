-- Diddl-Collect: profil_patch mit Stand-Handshake (additiv, NICHT destruktiv)
-- ==============================================================================
-- Bisher lieferte JEDER Markier-Upload die KOMPLETTE Profilzeile zurück
-- (~24k Uploads/Tag × volle Zeile = größter Egress-Posten). Neu: Der Client
-- schickt seinen letzten bekannten Server-Stand (p_stand) mit. Nur wenn
-- seitdem eine fremde Änderung einging (updated_at-Vergleich), kommt die
-- volle Zeile wie bisher – sonst nur {ok, aktualisiert_am} (Bytes).
-- Sync-Sicherheit: Bei jeglicher Kollision läuft exakt der bisherige
-- Merge-Pfad; der Normalfall (keine Kollision) ist per Konstruktion exakt.
-- Kompatibel beide Richtungen: ohne p_stand (Alt-Clients, Default null)
-- immer volle Zeile; neue Clients gegen alte DB mergen data.profil wie bisher.
-- Idempotent (create or replace). Bestehende Grants bleiben erhalten.

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
  p_anzahl_loesch text[] default null,
  p_stand timestamptz default null
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
  if p_stand is null or zeile.updated_at is distinct from p_stand then
    return json_build_object('profil', public.profil_json(zeile), 'aktualisiert_am', zeile.updated_at);
  end if;
  return json_build_object('ok', true, 'aktualisiert_am', zeile.updated_at);
end $$;

-- Diddl-Collect: Tausch-Rework – Rollback (erhält alle Bestandsdaten)
-- ==============================================================================
-- Setzt die Rework-Funktionen/Spalten wieder zurück. Die App fällt dann auf den
-- Single-Blatt-Modus zurück (altes Verhalten). Neuer Bestand (wunsch_blatter
-- mit mehreren Blättern) wird dabei in der Spalte verworfen – die bisherige
-- Anzeige nutzt weiterhin blatt_id, daher bleiben Angebote sichtbar.

drop function if exists public.angebot_aendern(text, text, jsonb, jsonb, numeric, text, text);

create or replace function public.angebot_anlegen(
  p_token text,
  p_id text,
  p_blatt_id text,
  p_anbieter_id text,
  p_anbieter_name text,
  p_angebot_blatter jsonb default '[]'::jsonb,
  p_angebot_betrag numeric default null,
  p_nachricht text default null
)
returns json
language plpgsql security definer set search_path = public, extensions
as $$
declare
  benutzer_id text := public.sitzung_benutzer(p_token);
  benutzer_name text;
  zeile public.tauschangebot%rowtype;
begin
  if benutzer_id is null then
    raise exception 'Sitzung abgelaufen – bitte neu anmelden.' using errcode = '28000';
  end if;
  select name into benutzer_name from public.profile where id = benutzer_id;
  if not exists (select 1 from public.profile where id = p_anbieter_id) then
    raise exception 'Dieser Anbieter existiert nicht.' using errcode = '23503';
  end if;
  insert into public.tauschangebot
    (id, blatt_id, anbieter_id, anbieter_name, interessent_id, interessent_name,
     angebot_blatter, angebot_betrag, nachricht, status, erstellt_am, aktualisiert_am)
  values
    (p_id, p_blatt_id, p_anbieter_id, p_anbieter_name, benutzer_id, benutzer_name,
     coalesce(p_angebot_blatter, '[]'::jsonb), p_angebot_betrag, p_nachricht,
     'offen', now(), now())
  returning * into zeile;
  return row_to_json(zeile);
end $$;

alter table public.tauschangebot drop column if exists wunsch_blatter;
alter table public.tauschangebot drop column if exists runde;
alter table public.postnachrichten drop column if exists typ;

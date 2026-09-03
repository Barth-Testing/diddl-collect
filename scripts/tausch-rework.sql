-- Diddl-Collect: Tausch-Rework – Migration (additiv, NICHT destruktiv)
-- ==============================================================================
-- Führt das turn-basierte Multi-Blatt-Tauschen ein:
--   * tauschangebot.wunsch_blatter : Blätter, die der Interessent vom Anbieter will
--   * tauschangebot.runde          : Zähler der Verhandlungsrunden
--   * postnachrichten.typ          : 'chat' oder 'aenderung' (System-Diff)
--   * angebot_anlegen              : optionaler Parameter p_wunsch_blatter
--   * angebot_aendern              : NEU – Gegenvorschlag/Turn-Update
-- Alte Aufrufer und Bestandsdaten bleiben vollständig kompatibel.
-- Rollback: scripts/tausch-rework-rollback.sql

alter table public.tauschangebot add column if not exists wunsch_blatter jsonb not null default '[]'::jsonb;
alter table public.tauschangebot add column if not exists runde integer not null default 1;
alter table public.postnachrichten add column if not exists typ text not null default 'chat';

-- Bestand nachziehen: alte Einzel-Blatt-Angebote gelten als Wunsch-Blatt.
update public.tauschangebot
   set wunsch_blatter = jsonb_build_array(blatt_id)
 where wunsch_blatter = '[]'::jsonb;

/** Tausch-Angebot eines Interessenten an einen Anbieter.
 *  p_wunsch_blatter = alle vom Interessenten angefragten Blätter des Anbieters
 *  (fehlt er, zählt wie bisher nur p_blatt_id – alte Clients bleiben kompatibel). */
create or replace function public.angebot_anlegen(
  p_token text,
  p_id text,
  p_blatt_id text,
  p_anbieter_id text,
  p_anbieter_name text,
  p_angebot_blatter jsonb default '[]'::jsonb,
  p_angebot_betrag numeric default null,
  p_nachricht text default null,
  p_wunsch_blatter jsonb default null
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
     angebot_blatter, angebot_betrag, nachricht, status, erstellt_am, aktualisiert_am,
     wunsch_blatter, runde)
  values
    (p_id, p_blatt_id, p_anbieter_id, p_anbieter_name, benutzer_id, benutzer_name,
     coalesce(p_angebot_blatter, '[]'::jsonb), p_angebot_betrag, p_nachricht,
     'offen', now(), now(),
     coalesce(p_wunsch_blatter, jsonb_build_array(p_blatt_id)), 1)
  returning * into zeile;
  return row_to_json(zeile);
end $$;

/** Gegenvorschlag / Turn-Update: Teilnehmer überarbeitet den kompletten Stand
 *  (angefragte Blätter, gebotene Blätter, Betrag, Nachricht).
 *  Schreibt zusätzlich eine Diff-Zusammenfassung als postnachricht (typ='aenderung'). */
create or replace function public.angebot_aendern(
  p_token text,
  p_angebot_id text,
  p_wunsch_blatter jsonb default null,
  p_gebe_blatter jsonb default null,
  p_angebot_betrag numeric default null,
  p_nachricht text default null,
  p_diff text default null
)
returns json
language plpgsql security definer set search_path = public, extensions
as $$
declare
  benutzer_id text := public.sitzung_benutzer(p_token);
  benutzer_name text;
  zeile public.tauschangebot%rowtype;
  v_typ text;
begin
  if benutzer_id is null then
    raise exception 'Sitzung abgelaufen – bitte neu anmelden.' using errcode = '28000';
  end if;
  select name into benutzer_name from public.profile where id = benutzer_id;
  if not exists (
    select 1 from public.tauschangebot
    where id = p_angebot_id and (anbieter_id = benutzer_id or interessent_id = benutzer_id)
  ) then
    raise exception 'Nicht dein Angebot.' using errcode = '42501';
  end if;
  update public.tauschangebot
     set wunsch_blatter = coalesce(p_wunsch_blatter, '[]'::jsonb),
         angebot_blatter = coalesce(p_gebe_blatter, '[]'::jsonb),
         angebot_betrag = p_angebot_betrag,
         nachricht = p_nachricht,
         runde = runde + 1,
         aktualisiert_am = now()
   where id = p_angebot_id
     and status = 'offen'
  returning * into zeile;
  if not found then
    raise exception 'Dieser Tausch ist nicht mehr offen.' using errcode = '42501';
  end if;
  v_typ := coalesce(p_diff, 'Angebot überarbeitet');
  insert into public.postnachrichten (angebot_id, autor, text, typ)
  values (p_angebot_id, 'System', left(v_typ, 500), 'aenderung');
  return row_to_json(zeile);
end $$;

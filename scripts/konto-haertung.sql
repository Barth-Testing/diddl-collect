-- Diddl-Collect: Konto-Härtung – Session-Tokens statt frei kopierbarer User-ID
-- ===========================================================================
-- Was sich ändert:
--  1. Login/Registrierung laufen serverseitig (anmelden/registrieren als RPC):
--     Passwort-Validierung und Token-Vergabe passieren in der DB. Die
--     Passwort-Hashes verlassen die Datenbank nicht mehr. Alte Konten mit
--     SHA-256-Hash bleiben gültig und werden beim nächsten Login automatisch
--     auf bcrypt (pgcrypto) umgehasht.
--  2. ALLE Schreibzugriffe der App laufen über Funktionen mit Session-Token
--     (256-Bit-Zufall, gespeichert nur als SHA-256-Hash, 30 Tage gültig).
--     Namen/Autoren (profil, forum, postfach, tausch) werden NIE mehr vom
--     Client übernommen, sondern serverseitig aus dem Konto abgeleitet.
--  3. Direkte Schreibrechte für anon werden entzogen (grants), Lesen bleibt
--     öffentlich – Profile/Galerien sind Community-Inhalt.
--  4. Neue Spalte profile.email (privat: für den Besitzer per RPC sichtbar,
--     für dich im Dashboard; anon kann die Spalte NICHT lesen).
--
-- Einmalig im Supabase SQL Editor ausführen: Dashboard → SQL Editor →
-- New query → Run. Laufzeit: wenige Sekunden, alle PKs bleiben erhalten.

create extension if not exists pgcrypto;

-- ============ Sessions ============

create table if not exists public.sitzungen (
  token_hash text primary key,
  benutzer_id text not null references public.profile(id) on delete cascade,
  erstellt_am timestamptz not null default now(),
  letzte_aktivitaet timestamptz not null default now(),
  abgelaufen_am timestamptz
);

alter table public.sitzungen enable row level security;

-- ============ E-Mail (privat) ============

alter table public.profile add column if not exists email text;

revoke select on table public.sitzungen from anon, authenticated;
revoke select (email) on table public.profile from anon, authenticated;

create unique index if not exists profile_email_lower_idx
  on public.profile (lower(email)) where email is not null;

-- ============ Schreibzugriffe schließen (Lesen bleibt offen) ============

revoke insert, update, delete on table public.profile from anon, authenticated;
revoke insert, update, delete on table public.tauschangebot from anon, authenticated;
revoke insert, update, delete on table public.postnachrichten from anon, authenticated;
revoke insert, update, delete on table public.nachrichten from anon, authenticated;
revoke insert, update, delete on table public.beweis_fotos from anon, authenticated;

-- ============ Hilfsfunktionen ============

/** User-ID zu einem gültigen Session-Token (sonst NULL). */
create or replace function public.sitzung_benutzer(p_token text)
returns text
language sql stable security definer set search_path = public, extensions
as $$
  select benutzer_id
  from public.sitzungen
  where token_hash = encode(sha256(p_token::bytea), 'hex')
    and (abgelaufen_am is null or abgelaufen_am > now())
$$;

/** Legt einen neuen Session-Eintrag an und liefert den rohen Token. */
create or replace function public.neue_sitzung(p_benutzer_id text)
returns text
language plpgsql security definer set search_path = public, extensions
as $$
declare
  token text := encode(gen_random_bytes(32), 'hex');
begin
  insert into public.sitzungen (token_hash, benutzer_id, abgelaufen_am)
  values (encode(sha256(token::bytea), 'hex'), p_benutzer_id, now() + interval '30 days');
  return token;
end $$;

/** Profil-Zeile als JSON ohne Passwort/E-Mail an die App geben. */
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
    'tausch', coalesce(p_zeile.tausch, '{}'::jsonb)
  );
$$;

-- Hinweis: Errortype 28000 = Session/Passwort ungültig – die App behandelt
-- diese Codes einheitlich ("Bitte neu anmelden") und wirft die Session raus.

-- ============ Anmeldung & Registrierung ============

create or replace function public.anmelden(p_name text, p_passwort text)
returns json
language plpgsql security definer set search_path = public, extensions
as $$
declare
  zeile public.profile%rowtype;
  token text;
  alter_hash boolean;
begin
  select * into zeile from public.profile where lower(name) = lower(p_name);
  if not found then
    raise exception 'Name oder Passwort stimmen nicht.' using errcode = '28000';
  end if;
  if zeile.passwort = crypt(p_passwort, zeile.passwort) then
    alter_hash := false;
  elsif zeile.passwort = encode(sha256(p_passwort::bytea), 'hex') then
    alter_hash := true;
  else
    raise exception 'Name oder Passwort stimmen nicht.' using errcode = '28000';
  end if;
  if alter_hash then
    update public.profile
       set passwort = crypt(p_passwort, gen_salt('bf', 10))
     where id = zeile.id;
  end if;
  token := public.neue_sitzung(zeile.id);
  return json_build_object('token', token, 'profil', public.profil_json(zeile));
end $$;

create or replace function public.registrieren(
  p_name text,
  p_passwort text,
  p_email text default null
)
returns json
language plpgsql security definer set search_path = public, extensions
as $$
declare
  zeile public.profile%rowtype;
  token text;
begin
  if length(trim(p_name)) < 2 then
    raise exception 'Der Sammlername braucht mindestens 2 Zeichen.' using errcode = '23514';
  end if;
  if length(p_passwort) < 4 then
    raise exception 'Das Passwort braucht mindestens 4 Zeichen.' using errcode = '23514';
  end if;
  if exists (select 1 from public.profile where lower(name) = lower(p_name)) then
    raise exception 'Diesen Sammlernamen gibt es schon – versuch einen anderen.' using errcode = '23505';
  end if;
  if p_email is not null then
    if p_email !~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$' then
      raise exception 'Bitte eine gültige E-Mail-Adresse angeben.' using errcode = '23514';
    end if;
    if exists (select 1 from public.profile where lower(email) = lower(p_email)) then
      raise exception 'Diese E-Mail-Adresse ist bereits hinterlegt.' using errcode = '23505';
    end if;
  end if;
  insert into public.profile (id, name, passwort, statuses, beweise, favoriten, tausch, email)
  values (
    'u-' || (extract(epoch from clock_timestamp())::bigint) || '-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 6),
    trim(p_name),
    crypt(p_passwort, gen_salt('bf', 10)),
    '{}'::jsonb, '{}'::jsonb, '{}'::jsonb, '{}'::jsonb,
    p_email
  )
  returning * into zeile;
  token := public.neue_sitzung(zeile.id);
  return json_build_object('token', token, 'profil', public.profil_json(zeile));
end $$;

-- ============ Schreibt-Funktionen (alle mit Session-Token) ============

/** Komplette Sammlung (statuses/beweise/favoriten/tausch) des Kontos updaten. */
create or replace function public.profil_schreiben(
  p_token text,
  p_statuses jsonb,
  p_beweise jsonb,
  p_favoriten jsonb,
  p_tausch jsonb
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
         tausch = coalesce(p_tausch, tausch)
   where id = benutzer_id;
end $$;

/** Beweisfoto hochladen (gleiches Blatt wird ersetzt). */
create or replace function public.beweis_hochladen(
  p_token text,
  p_blatt_id text,
  p_bild text
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
  insert into public.beweis_fotos (profil_id, blatt_id, bild)
  values (benutzer_id, p_blatt_id, p_bild)
  on conflict (profil_id, blatt_id) do update set bild = excluded.bild;
end $$;

/** Beweisfoto löschen. */
create or replace function public.beweis_loeschen(
  p_token text,
  p_blatt_id text
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
  delete from public.beweis_fotos where profil_id = benutzer_id and blatt_id = p_blatt_id;
end $$;

/** Tausch-Angebot eines Interessenten an einen Anbieter. */
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

/** Status eines Angebots ändern – nur Anbieter oder Interessent dürfen das. */
create or replace function public.angebot_status(
  p_token text,
  p_angebot_id text,
  p_status text
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
  if not exists (
    select 1 from public.tauschangebot
    where id = p_angebot_id and (anbieter_id = benutzer_id or interessent_id = benutzer_id)
  ) then
    raise exception 'Nicht dein Angebot.' using errcode = '42501';
  end if;
  update public.tauschangebot
     set status = p_status, aktualisiert_am = now()
   where id = p_angebot_id;
end $$;

/** Nachricht im Tausch-Thread – der Autor ist IMMER der angemeldete Nutzer. */
create or replace function public.post_senden(
  p_token text,
  p_angebot_id text,
  p_text text
)
returns json
language plpgsql security definer set search_path = public, extensions
as $$
declare
  benutzer_id text := public.sitzung_benutzer(p_token);
  benutzer_name text;
  zeile public.postnachrichten%rowtype;
begin
  if benutzer_id is null then
    raise exception 'Sitzung abgelaufen – bitte neu anmelden.' using errcode = '28000';
  end if;
  if length(trim(p_text)) between 1 and 500 then
    select name into benutzer_name from public.profile where id = benutzer_id;
    insert into public.postnachrichten (angebot_id, autor, text)
    values (p_angebot_id, benutzer_name, trim(p_text))
    returning * into zeile;
    return row_to_json(zeile);
  end if;
  return null;
end $$;

/** Forum-Nachricht – der Autor ist IMMER der angemeldete Nutzer. */
create or replace function public.forum_posten(
  p_token text,
  p_raum text,
  p_text text
)
returns json
language plpgsql security definer set search_path = public, extensions
as $$
declare
  benutzer_id text := public.sitzung_benutzer(p_token);
  benutzer_name text;
  zeile public.nachrichten%rowtype;
begin
  if benutzer_id is null then
    raise exception 'Sitzung abgelaufen – bitte neu anmelden.' using errcode = '28000';
  end if;
  if length(trim(p_text)) between 1 and 500 then
    select name into benutzer_name from public.profile where id = benutzer_id;
    insert into public.nachrichten (raum, autor, text)
    values (p_raum, benutzer_name, trim(p_text))
    returning * into zeile;
    return row_to_json(zeile);
  end if;
  return null;
end $$;

/** Passwort ändern: Name+altes Passwort zur Sicherheit; andere Geräte werden abgemeldet. */
create or replace function public.passwort_aendern(
  p_token text,
  p_name text,
  p_altes_passwort text,
  p_neues_passwort text
)
returns void
language plpgsql security definer set search_path = public, extensions
as $$
declare
  vid text := public.sitzung_benutzer(p_token);
  zeile public.profile%rowtype;
begin
  if vid is null then
    raise exception 'Sitzung abgelaufen – bitte neu anmelden.' using errcode = '28000';
  end if;
  select * into zeile from public.profile where id = vid;
  if lower(zeile.name) <> lower(trim(p_name)) then
    raise exception 'Der Benutzername passt nicht zum angemeldeten Konto.' using errcode = '42501';
  end if;
  if zeile.passwort <> crypt(p_altes_passwort, zeile.passwort)
     and zeile.passwort <> encode(sha256(p_altes_passwort::bytea), 'hex') then
    raise exception 'Das alte Passwort stimmt nicht.' using errcode = '28000';
  end if;
  if length(p_neues_passwort) < 4 then
    raise exception 'Das neue Passwort braucht mindestens 4 Zeichen.' using errcode = '23514';
  end if;
  update public.profile
     set passwort = crypt(p_neues_passwort, gen_salt('bf', 10))
   where id = vid;
  delete from public.sitzungen
   where benutzer_id = vid
     and token_hash <> encode(sha256(p_token::bytea), 'hex');
end $$;

-- ============ E-Mail (privat, nur Besitzer) ============

create or replace function public.lese_eigene_email(p_token text)
returns text
language sql stable security definer set search_path = public, extensions
as $$
  select email
  from public.profile
  where id = public.sitzung_benutzer(p_token)
$$;

create or replace function public.email_setzen(p_token text, p_email text)
returns void
language plpgsql security definer set search_path = public, extensions
as $$
declare
  benutzer_id text := public.sitzung_benutzer(p_token);
begin
  if benutzer_id is null then
    raise exception 'Sitzung abgelaufen – bitte neu anmelden.' using errcode = '28000';
  end if;
  if p_email !~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$' then
    raise exception 'Bitte eine gültige E-Mail-Adresse angeben.' using errcode = '23514';
  end if;
  if exists (select 1 from public.profile where lower(email) = lower(p_email) and id <> benutzer_id) then
    raise exception 'Diese E-Mail-Adresse ist bereits hinterlegt.' using errcode = '23505';
  end if;
  update public.profile set email = p_email where id = benutzer_id;
end $$;

create or replace function public.email_entfernen(p_token text)
returns void
language plpgsql security definer set search_path = public, extensions
as $$
declare
  benutzer_id text := public.sitzung_benutzer(p_token);
begin
  if benutzer_id is null then
    raise exception 'Sitzung abgelaufen – bitte neu anmelden.' using errcode = '28000';
  end if;
  update public.profile set email = null where id = benutzer_id;
end $$;

create or replace function public.abmelden(p_token text)
returns void
language sql security definer set search_path = public, extensions
as $$
  delete from public.sitzungen where token_hash = encode(sha256(p_token::bytea), 'hex')
$$;

-- ============ Lese-Zugriff auf Sessions bleibt geschlossen ============

drop policy if exists "Jeder darf Session lesen" on public.sitzungen;

-- Diddl-Collect: Bilder nach Supabase Storage (Egress-Diät, additiv)
-- ==============================================================================
-- Stand: News-Bilder (news.bild/bild2) und Beweisfotos (beweis_fotos.bild)
-- liegen als base64-Data-URLs in Textspalten (+33 % Overhead, kein CDN).
-- Neu: Uploads landen als WebP-Dateien in Storage-Buckets, in der DB steht
-- nur noch die öffentliche https-URL (~100 Zeichen).
--
-- Abwärtskompatibel per Design (darum KEINE Spaltenänderung):
--   * Die Spalten bleiben text und verstehen BEIDE Formate: alte
--     data:-URLs werden überall weiter angezeigt, neue https-URLs sogar von
--     ALTEN App-Versionen (absoluter Link im <img>).
--   * Alte Clients senden weiter base64 → die RPCs nehmen es an wie bisher.
--   * Neuer Client VOR diesem SQL: Upload scheitert → stiller Fallback auf
--     base64, alles wie bisher. Deploy-Reihenfolge egal.
-- Cross-Device: URLs sind reine Strings in denselben Spalten – Sync, Merge
--   und Markierungen bleiben unberührt. Alte Zeilen werden NICHT angefasst
--   (Lazy-Migration läuft geräteweise über news_bild_migrieren / erneuten
--   Beweis-Upload, nur wenn der aktuelle Wert noch data: ist).
-- Im SQL-Editor als Ganzes ausführen. Rollback: Buckets + Policies + die
-- news_bild_migrieren-Funktion löschen; alte RPC-Bodies stehen in
-- news-schreiben.sql / konto-haertung.sql (Git-Historie).

-- 1. Buckets (öffentlich lesbar) ----------------------------------------------
insert into storage.buckets (id, name, public)
values ('news-bilder', 'news-bilder', true),
       ('beweis-fotos', 'beweis-fotos', true)
on conflict (id) do update set public = excluded.public;

-- 2. Zugriffsregeln ------------------------------------------------------------
-- Lesen: öffentlich (CDN-fähig). Schreiben: nur Hochladen (anonyme App-
-- Clients mit eigenem Upload-Pfad); die Referenz-Gültigkeit prüft weiter die
-- RPC (Token/Admin) – verwaiste Dateien können nie verlinkt werden.
-- Ändern/Löschen per API: verboten (Pfade sind je Upload eindeutig; Löschen
-- läuft über beweis_loeschen als security definer direkt auf der Tabelle).
drop policy if exists "bilder-lesen" on storage.objects;
create policy "bilder-lesen" on storage.objects for select
  to anon, authenticated
  using (bucket_id in ('news-bilder', 'beweis-fotos'));

drop policy if exists "bilder-hochladen" on storage.objects;
create policy "bilder-hochladen" on storage.objects for insert
  to anon, authenticated
  with check (bucket_id in ('news-bilder', 'beweis-fotos'));

-- 3. news_schreiben: gleiche Signatur (keine Überladung!), p_bild versteht
--    data-URL (alt, max. 500 KB) oder öffentliche Storage-URL (neu). ----------
create or replace function public.news_schreiben(
  p_token text,
  p_titel text,
  p_text text,
  p_bild text default null,
  p_link text default null
)
returns json
language plpgsql security definer set search_path = public, extensions
as $$
declare
  v_benutzer_id text := public.sitzung_benutzer(p_token);
  v_benutzer_name text;
  v_bild text := nullif(trim(coalesce(p_bild, '')), '');
  zeile public.news%rowtype;
begin
  if v_benutzer_id is null then
    raise exception 'Sitzung abgelaufen – bitte neu anmelden.' using errcode = '28000';
  end if;
  select p.name into v_benutzer_name from public.profile as p where p.id = v_benutzer_id;
  /* Alt-Konten können End-Punkte tragen ("Malarky.") – wie im Client tolerant prüfen. */
  if v_benutzer_name is null
    or lower(rtrim(trim(v_benutzer_name), '.')) not in ('malarky', 'blondy') then
    raise exception 'Nur für die Seitenbetreiber.' using errcode = '42501';
  end if;
  if char_length(trim(coalesce(p_titel, ''))) not between 1 and 120 then
    raise exception 'Der Titel braucht 1 bis 120 Zeichen.' using errcode = '23514';
  end if;
  if char_length(trim(coalesce(p_text, ''))) not between 1 and 1000 then
    raise exception 'Der Text braucht 1 bis 1000 Zeichen.' using errcode = '23514';
  end if;
  if p_link is not null and char_length(p_link) > 500 then
    raise exception 'Der Link ist zu lang.' using errcode = '23514';
  end if;
  if v_bild is not null then
    if v_bild like 'data:image/%' then
      if char_length(v_bild) > 500000 then
        raise exception 'Das Bild ist zu groß.' using errcode = '23514';
      end if;
    elsif v_bild ~ '^https://[^/]+/storage/v1/object/public/news-bilder/[A-Za-z0-9_./-]+\.(webp|jpg|jpeg|png)$'
      and v_bild not like '%..%' and char_length(v_bild) <= 500 then
      null; /* Neue Storage-URL – Format ok. */
    elsif v_bild like '/%' and v_bild not like '//%' and v_bild not like '%..%'
      and char_length(v_bild) <= 500 then
      null; /* App-relativer Pfad (public/, Cloudflare) – null Supabase-Egress. */
    else
      raise exception 'Ungültiges Bildformat.' using errcode = '23514';
    end if;
  end if;
  insert into public.news (titel, text, bild, link)
  values (
    trim(p_titel),
    trim(p_text),
    v_bild,
    nullif(trim(coalesce(p_link, '')), '')
  )
  returning * into zeile;
  return row_to_json(zeile);
end $$;

grant execute on function public.news_schreiben(text, text, text, text, text) to anon;

-- 4. news_bild_migrieren: Alt-Bild (data:) ODER übergroße eigene Storage-URL
--    still auf schlanke Storage-URL umziehen. Nur Admin-Kreis; betrifft NUR
--    Zeilen, deren Wert noch data: oder eine eigene Bucket-URL ist (niemals
--    fremde Hotlinks überschreiben – Race-sicher). Neue Funktion: drop zuerst,
--    damit keine stille Überladung entstehen kann. Stand: news-migration-https.sql
drop function if exists public.news_bild_migrieren(text, bigint, text, text);
drop function if exists public.news_bild_migrieren(text, bigint, text, text);
create function public.news_bild_migrieren(
  p_token text,
  p_news_id bigint,
  p_feld text,
  p_url text
)
returns void
language plpgsql security definer set search_path = public, extensions
as $$
declare
  v_benutzer_id text := public.sitzung_benutzer(p_token);
  v_benutzer_name text;
  v_url text := nullif(trim(coalesce(p_url, '')), '');
begin
  if v_benutzer_id is null then
    raise exception 'Sitzung abgelaufen – bitte neu anmelden.' using errcode = '28000';
  end if;
  select p.name into v_benutzer_name from public.profile as p where p.id = v_benutzer_id;
  if v_benutzer_name is null
    or lower(rtrim(trim(v_benutzer_name), '.')) not in ('malarky', 'blondy') then
    raise exception 'Nur für die Seitenbetreiber.' using errcode = '42501';
  end if;
  if p_feld not in ('bild', 'bild2') then
    raise exception 'Unbekanntes Bildfeld.' using errcode = '23514';
  end if;
  if v_url is null
    or v_url !~ '^https://[^/]+/storage/v1/object/public/news-bilder/[A-Za-z0-9_./-]+\.(webp|jpg|jpeg|png)$'
    or v_url like '%..%' or char_length(v_url) > 500 then
    raise exception 'Ungültiges Bildformat.' using errcode = '23514';
  end if;
  execute format(
    'update public.news set %I = $1 where id = $2 and (%I like ''data:%%'' or %I like ''%%/storage/v1/object/public/news-bilder/%%'')',
    p_feld, p_feld, p_feld
  ) using v_url, p_news_id;
end $$;

grant execute on function public.news_bild_migrieren(text, bigint, text, text) to anon;

-- 5. beweis_hochladen: gleiche Signatur. p_bild versteht data-URL (NEU mit
--    500-KB-Deckel wie bei News – bisher unbegrenzt!) oder Storage-URL, die
--    im ORDNER des aufrufenden Kontos liegen muss (Eigentums-Bindung). --------
create or replace function public.beweis_hochladen(
  p_token text,
  p_blatt_id text,
  p_bild text
)
returns void
language plpgsql security definer set search_path = public, extensions
as $$
declare
  v_benutzer_id text := public.sitzung_benutzer(p_token);
  v_bild text := nullif(trim(coalesce(p_bild, '')), '');
begin
  if v_benutzer_id is null then
    raise exception 'Sitzung abgelaufen – bitte neu anmelden.' using errcode = '28000';
  end if;
  if v_bild is null then
    raise exception 'Kein Bild übergeben.' using errcode = '23514';
  end if;
  if v_bild like 'data:image/%' then
    if char_length(v_bild) > 500000 then
      raise exception 'Das Bild ist zu groß.' using errcode = '23514';
    end if;
  elsif v_bild ~ '^https://[^/]+/storage/v1/object/public/beweis-fotos/[A-Za-z0-9_./-]+\.(webp|jpg|jpeg|png)$'
    and v_bild not like '%..%' and char_length(v_bild) <= 500
    and v_bild like '%/beweis-fotos/' || v_benutzer_id || '/%' then
    null; /* Eigene Storage-URL – Format ok. */
  else
    raise exception 'Ungültiges Bildformat.' using errcode = '23514';
  end if;
  insert into public.beweis_fotos (profil_id, blatt_id, bild)
  values (v_benutzer_id, p_blatt_id, v_bild)
  on conflict (profil_id, blatt_id) do update set bild = excluded.bild;
end $$;

grant execute on function public.beweis_hochladen(text, text, text) to anon;

-- 6. beweis_loeschen: gleiche Signatur + entfernt zusätzlich die Storage-
--    Datei (direkt auf storage.objects – definer umgeht RLS; ohne Policy ist
--    sie per API für niemanden löschbar). --------------------------------------
create or replace function public.beweis_loeschen(
  p_token text,
  p_blatt_id text
)
returns void
language plpgsql security definer set search_path = public, extensions
as $$
declare
  v_benutzer_id text := public.sitzung_benutzer(p_token);
  v_bild text;
  v_name text;
begin
  if v_benutzer_id is null then
    raise exception 'Sitzung abgelaufen – bitte neu anmelden.' using errcode = '28000';
  end if;
  select f.bild into v_bild from public.beweis_fotos as f
  where f.profil_id = v_benutzer_id and f.blatt_id = p_blatt_id;
  delete from public.beweis_fotos where profil_id = v_benutzer_id and blatt_id = p_blatt_id;
  if v_bild like 'https://%/storage/v1/object/public/beweis-fotos/%' then
    v_name := substring(v_bild from '/beweis-fotos/(.*)$');
    if v_name like v_benutzer_id || '/%' then
      delete from storage.objects as o
      where o.bucket_id = 'beweis-fotos' and o.name = v_name;
    end if;
  end if;
end $$;

grant execute on function public.beweis_loeschen(text, text) to anon;

-- Verifikation (nach dem Ausführen):
--   select id, public from storage.buckets where id in ('news-bilder', 'beweis-fotos');
--     Erwartet: 2 Zeilen, public = true.
--   select policyname from pg_policies where schemaname = 'storage'
--     and tablename = 'objects' and policyname in ('bilder-lesen', 'bilder-hochladen');
--     Erwartet: 2 Zeilen.
--   App-Test: Neues News-Bild + neues Beweisfoto landen als https-URL in der
--     DB (statt data:), Anzeige auf Zweitgerät ohne Neuanmeldung.

-- Diddl-Collect: News-Migration auch für übergroße Storage-URLs (additiv)
-- ==============================================================================
-- Fall: News-Bilder wurden manuell in Originalgröße in den Bucket gelegt
-- (z. B. surprise_delivery.jpeg, MB statt KB) und per URL in news.bild
-- verlinkt. Die bisherige news_bild_migrieren ersetzte NUR data:-Werte.
-- Neu: Sie ersetzt zusätzlich https-URLs aus dem eigenen news-bilder-Bucket –
-- der Client lädt solche Dateien nur, wenn sie >250 KB sind, kodiert sie
-- schlank neu (WebP, 640 px) und tauscht still. Alte (kleine) URLs bleiben
-- unangetastet. Nur Admin-Kreis (wie bisher). Alte Datei verwaist im Bucket
-- (per Dashboard löschbar) – kein Datenverlust, Anzeige nie unterbrochen.
-- Im SQL-Editor ausführen. Kein Rollback nötig (reine Guard-Erweiterung).

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

-- Verifikation:
--   select proname, oidvectortypes(proargtypes) from pg_proc
--   where pronamespace = 'public'::regnamespace and proname = 'news_bild_migrieren';
--   Erwartet: genau 1 Zeile (text, bigint, text, text).

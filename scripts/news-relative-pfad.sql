-- Diddl-Collect: news_schreiben akzeptiert app-relative Bildpfade (additiv)
-- ==============================================================================
-- Drittes Bildformat neben data: und Storage-URL: Pfade wie
-- /surprise_delivery.jpeg (Datei in public/, ausgeliefert per Cloudflare –
-- null Supabase-Egress, offlinefähig per Service Worker). Zwei News-Zeilen
-- nutzen das bereits – ohne diese Freigabe würde ein künftiges Neu-
-- Speichern sie ablehnen. Gleiche Signatur (keine Überladungsgefahr).
-- Im SQL-Editor ausführen.

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
      null;
    elsif v_bild like '/%' and v_bild not like '//%' and v_bild not like '%..%'
      and char_length(v_bild) <= 500 then
      null;
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

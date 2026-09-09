-- Diddl-Collect: lese_ungelesene/post_gelesen reparieren (42702-Härtung)
-- ==============================================================================
-- Befund (Log 09.09.2026): lese_ungelesene schlägt zu 100 % fehl –
--   22× POST /rpc/lese_ungelesene → 400 plus 22× postgres 42702
--   'column reference "benutzer_id" is ambiguous'.
-- Ursache: Die Variable heißt wie die Tabellenspalte (post_lesestand /
--   sitzungen). Je nach deployed Revision löst der Parser den Namen zum
--   falschen (oder zu zwei) Spalten auf. Folge: Der Postfach-Badge fällt auf
--   den globalen Voll-Download (500 Angebote + Posts) zurück – Egress-Bombe.
--
-- Fix: Funktionen zuerst DROPPEN (entfernt auch stille Überladungen – NIEMALS
--   nur create-or-replace bei Signatur-Verdacht!), dann mit v_-präfixierten
--   Variablen und voll qualifizierten Spalten neu anlegen. Logik unverändert.
-- Im SQL-Editor als Ganzes ausführen (additiv, kein Datenverlust).

drop function if exists public.lese_ungelesene(text);
drop function if exists public.post_gelesen(text, text);

/** Thread als "gelesen" markieren – nur für Teilnehmer des Threads. */
create function public.post_gelesen(p_token text, p_angebot_id text)
returns void
language plpgsql security definer set search_path = public, extensions
as $$
declare
  v_benutzer_id text := public.sitzung_benutzer(p_token);
begin
  if v_benutzer_id is null then
    raise exception 'Sitzung abgelaufen – bitte neu anmelden.' using errcode = '28000';
  end if;
  if not exists (
    select 1 from public.tauschangebot t
    where t.id = p_angebot_id
      and (t.anbieter_id = v_benutzer_id or t.interessent_id = v_benutzer_id)
  ) then
    raise exception 'Nicht dein Thread.' using errcode = '42501';
  end if;
  insert into public.post_lesestand as l (benutzer_id, angebot_id)
  values (v_benutzer_id, p_angebot_id)
  on conflict (benutzer_id, angebot_id)
  do update set gelesen_am = now();
end $$;

/** IDs aller Threads des Benutzers mit ungelesenen fremden Nachrichten.
 *  Zählt wie der Client: Nachrichten, deren autor != eigener Name (System-
 *  Diffs zählen mit), nach dem letzten Gelesen-Zeitpunkt. */
create function public.lese_ungelesene(p_token text)
returns text[]
language plpgsql security definer set search_path = public, extensions
as $$
declare
  v_benutzer_id text := public.sitzung_benutzer(p_token);
  v_benutzer_name text;
  v_ergebnis text[];
begin
  if v_benutzer_id is null then
    raise exception 'Sitzung abgelaufen – bitte neu anmelden.' using errcode = '28000';
  end if;
  select p.name into v_benutzer_name from public.profile as p where p.id = v_benutzer_id;
  select array_agg(t.id order by t.erstellt_am desc)
    into v_ergebnis
  from public.tauschangebot as t
  where (t.anbieter_id = v_benutzer_id or t.interessent_id = v_benutzer_id)
    and t.status not in ('storniert', 'abgelehnt')
    and exists (
      select 1
      from public.postnachrichten as p
      where p.angebot_id = t.id
        and p.autor is distinct from v_benutzer_name
        and p.erstellt_am > coalesce(
          (select l.gelesen_am from public.post_lesestand as l
            where l.benutzer_id = v_benutzer_id and l.angebot_id = t.id),
          'epoch'::timestamptz
        )
    );
  return coalesce(v_ergebnis, '{}'::text[]);
end $$;

grant execute on function public.post_gelesen(text, text) to anon;
grant execute on function public.lese_ungelesene(text) to anon;

-- Verifikation (nach dem Ausführen):
--   1. Genau EINE Überladung je Funktion (kein 300er-Loop wie bei profil_patch):
--      select proname, oidvectortypes(proargtypes) from pg_proc
--      where pronamespace = 'public'::regnamespace
--        and proname in ('lese_ungelesene', 'post_gelesen');
--      Erwartet: je genau 1 Zeile.
--   2. Logik-Test mit echter Benutzer-ID (eine Zeile, kein 42702):
--      select t.id from public.tauschangebot as t
--      where (t.anbieter_id = '<BENUTZER_ID>' or t.interessent_id = '<BENUTZER_ID>')
--        and t.status not in ('storniert', 'abgelehnt')
--      limit 1;
--   3. App-Test: Postfach-Badge erscheint/verschwindet geräteübergreifend;
--      im Log keine 400 mehr auf /rpc/lese_ungelesene und keine globalen
--      tauschangebot-Downloads (limit=500 OHNE or-Filter) mehr.

-- Diddl-Collect: Lesestand-Sync über Geräte hinweg (additiv, NICHT destruktiv)
-- ==============================================================================
-- Problem: diddlcollect:postgelesen lag nur im localStorage (pro Gerät) – die
-- Postfach-1 blieb auf dem zweiten Gerät stehen. Der Header (PostfachLink)
-- lud für die 1 sogar bis zu 500 Angebote + 2000 Posts GLOBAL (Egress-Bombe).
--
-- Lösung:
--   * post_lesestand : pro (Benutzer, Thread) der Zeitpunkt "gelesen"
--   * post_gelesen   : winziger Write beim Thread-Öffnen (security definer)
--   * lese_ungelesene: Mini-RPC, liefert NUR die Thread-IDs mit ungelesenen
--                      fremden Nachrichten (Bytes statt MB)
-- Die App lädt Thread-Inhalte nur noch gefiltert (eigene Threads).
-- Rollback: drop table public.post_lesestand; + drop function je RPC.

create table if not exists public.post_lesestand (
  benutzer_id text not null,
  angebot_id text not null,
  gelesen_am timestamptz not null default now(),
  primary key (benutzer_id, angebot_id)
);

-- Kein direkter Zugriff: Lesen/Schreiben nur über die RPCs.
revoke all on table public.post_lesestand from anon, authenticated;

/** Thread als "gelesen" markieren – nur für Teilnehmer des Threads. */
create or replace function public.post_gelesen(p_token text, p_angebot_id text)
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
    select 1 from public.tauschangebot t
    where t.id = p_angebot_id
      and (t.anbieter_id = benutzer_id or t.interessent_id = benutzer_id)
  ) then
    raise exception 'Nicht dein Thread.' using errcode = '42501';
  end if;
  insert into public.post_lesestand (benutzer_id, angebot_id)
  values (benutzer_id, p_angebot_id)
  on conflict (benutzer_id, angebot_id)
  do update set gelesen_am = now();
end $$;

/** IDs aller Threads des Benutzers mit ungelesenen fremden Nachrichten.
 *  Zählt wie der Client: Nachrichten, deren autor != eigener Name (System-
 *  Diffs zählen mit), nach dem letzten Gelesen-Zeitpunkt. */
create or replace function public.lese_ungelesene(p_token text)
returns text[]
language plpgsql security definer set search_path = public, extensions
as $$
declare
  benutzer_id text := public.sitzung_benutzer(p_token);
  benutzer_name text;
  ergebnis text[];
begin
  if benutzer_id is null then
    raise exception 'Sitzung abgelaufen – bitte neu anmelden.' using errcode = '28000';
  end if;
  select name into benutzer_name from public.profile where id = benutzer_id;
  select array_agg(t.id order by t.erstellt_am desc)
    into ergebnis
  from public.tauschangebot t
  where (t.anbieter_id = benutzer_id or t.interessent_id = benutzer_id)
    and t.status not in ('storniert', 'abgelehnt')
    and exists (
      select 1
      from public.postnachrichten p
      where p.angebot_id = t.id
        and p.autor is distinct from benutzer_name
        and p.erstellt_am > coalesce(
          (select l.gelesen_am from public.post_lesestand l
            where l.benutzer_id = benutzer_id and l.angebot_id = t.id),
          'epoch'::timestamptz
        )
    );
  return coalesce(ergebnis, '{}'::text[]);
end $$;

grant execute on function public.post_gelesen(text, text) to anon;
grant execute on function public.lese_ungelesene(text) to anon;

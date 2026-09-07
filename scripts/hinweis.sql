-- Diddl-Collect: Hinweis-Button (additiv, NICHT destruktiv)
-- ==============================================================================
-- Ein schwebender Hinweis-Button rechts unten (nur für eingeloggte Nutzer),
-- z. B. "Blöcke verfügbar". Text, Link und An/Aus schaltet der Admin-Kreis
-- (malarky, blondy) per UI (Komponente HinweisEditor). Ist der Hinweis
-- inaktiv, rendert der Button gar nichts.
-- Rollback: drop function if exists public.hinweis_setzen(text, text, text, boolean);
--           drop table if exists public.hinweis;

create table if not exists public.hinweis (
  id smallint primary key,
  text text not null default '',
  link text,
  aktiv boolean not null default false,
  updated_at timestamptz not null default now()
);

insert into public.hinweis (id, text, link, aktiv)
values (1, '', null, false)
on conflict (id) do nothing;

alter table public.hinweis enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'hinweis' and policyname = 'Jeder darf Hinweis lesen'
  ) then
    create policy "Jeder darf Hinweis lesen"
      on public.hinweis for select
      using (true);
  end if;
end $$;

/** Hinweis-Button pflegen – nur für den Admin-Kreis. */
create or replace function public.hinweis_setzen(
  p_token text,
  p_text text,
  p_link text default null,
  p_aktiv boolean default false
)
returns void
language plpgsql security definer set search_path = public, extensions
as $$
declare
  benutzer_id text := public.sitzung_benutzer(p_token);
  benutzer_name text;
begin
  if benutzer_id is null then
    raise exception 'Sitzung abgelaufen – bitte neu anmelden.' using errcode = '28000';
  end if;
  select name into benutzer_name from public.profile where id = benutzer_id;
  if benutzer_name is null
    or lower(rtrim(trim(benutzer_name), '.')) not in ('malarky', 'blondy') then
    raise exception 'Nur für die Seitenbetreiber.' using errcode = '42501';
  end if;
  if p_aktiv and char_length(trim(coalesce(p_text, ''))) not between 1 and 120 then
    raise exception 'Aktiver Hinweis braucht 1 bis 120 Zeichen Text.' using errcode = '23514';
  end if;
  if char_length(coalesce(p_text, '')) > 120 then
    raise exception 'Der Text ist zu lang (max. 120 Zeichen).' using errcode = '23514';
  end if;
  if p_link is not null and char_length(p_link) > 500 then
    raise exception 'Der Link ist zu lang.' using errcode = '23514';
  end if;
  update public.hinweis
     set text = trim(coalesce(p_text, '')),
         link = nullif(trim(coalesce(p_link, '')), ''),
         aktiv = coalesce(p_aktiv, false),
         updated_at = now()
   where id = 1;
end $$;

grant execute on function public.hinweis_setzen(text, text, text, boolean) to anon;

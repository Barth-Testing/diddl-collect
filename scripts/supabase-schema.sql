-- Knuddelblätter – Chat/Foren- und Konten-Einrichtung
-- Einmalig im Supabase SQL Editor ausführen (Dashboard → SQL Editor → New query → Run).

-- ============ Konten (Sammlernamen, Häkchen, Beweise) ============

create table if not exists public.profile (
  id text primary key,
  name text not null,
  passwort text not null,
  created_at timestamptz not null default now(),
  statuses jsonb not null default '{}'::jsonb,
  beweise jsonb not null default '{}'::jsonb
);

create unique index if not exists profile_name_lower_idx on public.profile (lower(name));

alter table public.profile enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'profile' and policyname = 'Jeder darf Profile lesen'
  ) then
    create policy "Jeder darf Profile lesen"
      on public.profile for select
      using (true);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'profile' and policyname = 'Jeder darf Profile anlegen'
  ) then
    create policy "Jeder darf Profile anlegen"
      on public.profile for insert
      with check (true);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'profile' and policyname = 'Jeder darf Profile aktualisieren'
  ) then
    create policy "Jeder darf Profile aktualisieren"
      on public.profile for update
      using (true);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'profile' and policyname = 'Jeder darf Profile löschen'
  ) then
    create policy "Jeder darf Profile löschen"
      on public.profile for delete
      using (true);
  end if;
end $$;

-- ============ Chat ============

create table if not exists public.nachrichten (
  id bigint generated always as identity primary key,
  raum text not null default 'allgemein',
  autor text not null,
  text text not null check (char_length(text) between 1 and 500),
  erstellt_am timestamptz not null default now()
);

create index if not exists nachrichten_raum_idx on public.nachrichten (raum, id desc);

alter table public.nachrichten enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'nachrichten' and policyname = 'Jeder darf lesen'
  ) then
    create policy "Jeder darf lesen"
      on public.nachrichten for select
      using (true);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'nachrichten' and policyname = 'Jeder darf schreiben'
  ) then
    create policy "Jeder darf schreiben"
      on public.nachrichten for insert
      with check (true);
  end if;
end $$;

-- Echtzeit aktivieren, damit neue Nachrichten sofort ankommen.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'nachrichten'
  ) then
    alter publication supabase_realtime add table public.nachrichten;
  end if;
end $$;

-- ============ Neuigkeiten (Startseite) ============
-- Weitere Einträge fügt der Seitenbetreiber direkt per SQL ein, z. B.:
--   insert into public.news (titel, text) values ('Neue Blätter', 'Der Katalog hat Zuwachs bekommen!');

create table if not exists public.news (
  id bigint generated always as identity primary key,
  titel text not null,
  text text not null check (char_length(text) between 1 and 1000),
  erstellt_am timestamptz not null default now()
);

alter table public.news enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'news' and policyname = 'Jeder darf News lesen'
  ) then
    create policy "Jeder darf News lesen"
      on public.news for select
      using (true);
  end if;
end $$;

insert into public.news (titel, text)
select 'Diddl ist zurück!',
       'Sonderkollektionen in verschiedenen Expert-Märkten entdeckt! Aktuell häufen sich Meldungen, dass verschiedene Expert-Märkte einen neuen Aufsteller im Laden haben – die kleine Knuddelmaus ist also tatsächlich zurück, und mit ihr frische Sonderkollektionen zum Sammeln. Wie immer gilt: Schnell vergriffen! Wenn ihr eine Filiale in der Nähe habt, lohnt sich ein Blick auf jeden Fall. Und wer etwas entdeckt: Teilt eure Funde im Forum und zeigt der Gemeinde, wo die neuen Blätter warten.'
where not exists (select 1 from public.news where titel = 'Diddl ist zurück!');

-- ============ Tauschbörse ============
-- Wunschbetrag/Notiz pro "zum Tausch"-Blatt direkt am Profil.

alter table public.profile add column if not exists tausch jsonb not null default '{}'::jsonb;

-- Tauschangebote: Interessent bietet eigene Blätter und/oder Geld gegen ein Tauschblatt.

create table if not exists public.tauschangebot (
  id text primary key,
  blatt_id text not null,
  anbieter_id text not null,
  anbieter_name text not null,
  interessent_id text not null,
  interessent_name text not null,
  angebot_blatter jsonb not null default '[]'::jsonb,
  angebot_betrag numeric,
  nachricht text,
  status text not null default 'offen',
  erstellt_am timestamptz not null default now(),
  aktualisiert_am timestamptz not null default now()
);

create index if not exists tauschangebot_anbieter_idx on public.tauschangebot (anbieter_id);
create index if not exists tauschangebot_interessent_idx on public.tauschangebot (interessent_id);

alter table public.tauschangebot enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'tauschangebot' and policyname = 'Jeder darf Tauschangebote lesen'
  ) then
    create policy "Jeder darf Tauschangebote lesen"
      on public.tauschangebot for select
      using (true);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'tauschangebot' and policyname = 'Jeder darf Tauschangebote anlegen'
  ) then
    create policy "Jeder darf Tauschangebote anlegen"
      on public.tauschangebot for insert
      with check (true);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'tauschangebot' and policyname = 'Jeder darf Tauschangebote aktualisieren'
  ) then
    create policy "Jeder darf Tauschangebote aktualisieren"
      on public.tauschangebot for update
      using (true);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'tauschangebot' and policyname = 'Jeder darf Tauschangebote löschen'
  ) then
    create policy "Jeder darf Tauschangebote löschen"
      on public.tauschangebot for delete
      using (true);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'tauschangebot'
  ) then
    alter publication supabase_realtime add table public.tauschangebot;
  end if;
end $$;

-- Privates Postfach: Nachrichten zu einem Tauschangebot (Thread = angebot_id).

create table if not exists public.postnachrichten (
  id bigint generated always as identity primary key,
  angebot_id text not null,
  autor text not null,
  text text not null check (char_length(text) between 1 and 500),
  erstellt_am timestamptz not null default now()
);

create index if not exists postnachrichten_angebot_idx on public.postnachrichten (angebot_id, id);

alter table public.postnachrichten enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'postnachrichten' and policyname = 'Jeder darf Post lesen'
  ) then
    create policy "Jeder darf Post lesen"
      on public.postnachrichten for select
      using (true);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'postnachrichten' and policyname = 'Jeder darf Post schreiben'
  ) then
    create policy "Jeder darf Post schreiben"
      on public.postnachrichten for insert
      with check (true);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'postnachrichten'
  ) then
    alter publication supabase_realtime add table public.postnachrichten;
  end if;
end $$;
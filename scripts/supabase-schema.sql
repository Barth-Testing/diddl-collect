-- Knuddelblätter – Chat/Foren-Einrichtung
-- Einmalig im Supabase SQL Editor ausführen (Dashboard → SQL Editor → New query → Run).

create table if not exists public.nachrichten (
  id bigint generated always as identity primary key,
  raum text not null default 'allgemein',
  autor text not null,
  text text not null check (char_length(text) between 1 and 500),
  erstellt_am timestamptz not null default now()
);

create index if not exists nachrichten_raum_idx on public.nachrichten (raum, id desc);

alter table public.nachrichten enable row level security;

create policy "Jeder darf lesen"
  on public.nachrichten for select
  using (true);

create policy "Jeder darf schreiben"
  on public.nachrichten for insert
  with check (true);

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

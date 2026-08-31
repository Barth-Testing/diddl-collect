-- Spender-Ehrungen: Freitext-Namen für Spender, die (noch) kein Konto haben.
-- Der Betreiber pflegt die Liste per SQL – keine App-Automatik nötig.
-- Die App zeigt die Namen in der Rangliste ("Danke an unsere Unterstützer!").
-- Idempotent; anon darf nur lesen (schreiben nur der Betreiber via Dashboard).

create table if not exists public.spender_ehrungen (
  id bigint generated always as identity primary key,
  name text not null,
  erstellt_am timestamptz not null default now()
);

alter table public.spender_ehrungen enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'spender_ehrungen' and policyname = 'Jeder darf lesen'
  ) then
    create policy "Jeder darf lesen"
      on public.spender_ehrungen for select
      using (true);
  end if;
end $$;

-- Beispiel-Eintrag (Name anpassen):
-- insert into public.spender_ehrungen (name) values ('Spender via PayPal');

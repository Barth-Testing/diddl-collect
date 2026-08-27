-- Beweisfotos: Altlast-Backfill
-- Führt die base64-Fotos, die vor der Auslagerung noch inline in
-- profile.beweise gespeichert wurden, in die eigene Tabelle beweis_fotos
-- über und ersetzt den Wert jeweils durch true. Danach enthält
-- profile.beweise nur noch kleine Boolean-Marker -> die Spalte kann bei
-- Massen-Abrufen (Startseite, Sync) winzig mitgeladen werden.
--
-- Sicher & idempotent: keine Fotos gehen verloren (sie landen in der
-- eigenen Tabelle), vorhandene Einträge werden nicht überschrieben,
-- erneutes Ausführen ist ein No-op. Einmal im Supabase SQL Editor
-- ausführen (Dashboard -> SQL Editor -> New query -> Run).

-- 1) Tabelle (falls noch nicht vorhanden) anlegen + Rechte für die App.
create table if not exists public.beweis_fotos (
  id bigint generated always as identity primary key,
  profil_id text not null references public.profile(id) on delete cascade,
  blatt_id text not null,
  bild text not null,
  erstellt_am timestamptz not null default now()
);

create index if not exists beweis_fotos_profil_idx on public.beweis_fotos (profil_id);

alter table public.beweis_fotos enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'beweis_fotos' and policyname = 'Jeder darf Beweisfotos lesen'
  ) then
    create policy "Jeder darf Beweisfotos lesen"
      on public.beweis_fotos for select using (true);
  end if;
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'beweis_fotos' and policyname = 'Jeder darf Beweisfotos anlegen'
  ) then
    create policy "Jeder darf Beweisfotos anlegen"
      on public.beweis_fotos for insert with check (true);
  end if;
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'beweis_fotos' and policyname = 'Jeder darf Beweisfotos löschen'
  ) then
    create policy "Jeder darf Beweisfotos löschen"
      on public.beweis_fotos for delete using (true);
  end if;
end $$;

-- 2) Backfill: Strings aus profile.beweise -> beweis_fotos, Wert auf true setzen.
do $$
declare
  p record;
  e record;
  neu jsonb;
begin
  for p in select id, beweise from public.profile where beweise is not null loop
    neu := p.beweise;
    for e in select key, value from jsonb_each(p.beweise) loop
      if jsonb_typeof(e.value) = 'string' then
        insert into public.beweis_fotos (profil_id, blatt_id, bild)
        values (p.id, e.key, e.value #>> '{}')
        on conflict do nothing;
        neu := jsonb_set(neu, array[e.key], 'true'::jsonb);
      end if;
    end loop;
    if neu is distinct from p.beweise then
      update public.profile set beweise = neu where id = p.id;
    end if;
  end loop;
end $$;

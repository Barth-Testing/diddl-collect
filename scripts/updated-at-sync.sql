-- updated_at für profil: erlaubt der App einen Mini-Check (einige Bytes)
-- statt des vollen JSONB-Downloads bei jedem Eigen-Poll (Cross-Device-Sync
-- bleibt so live, ohne Egress zu verbrauchen). Idempotent & nicht-destruktiv.
-- Ausführung: Supabase SQL-Editor (Projekt "Diddl-Collect").

alter table public.profile add column if not exists updated_at timestamptz not null default now();

create or replace function public.setze_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profile_updated_at on public.profile;
create trigger profile_updated_at
before update on public.profile
for each row
execute function public.setze_updated_at();

-- anon darf diese Spalte lesen (sonst 42501 = stiller Sync-Tod, siehe AGENTS.md).
grant select (updated_at) on public.profile to anon;

update public.profile set updated_at = now() where updated_at is null;

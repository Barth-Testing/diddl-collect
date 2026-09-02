-- Diddl-Collect: Kontaktformular -> Postfach des Betreibers
-- ===========================================================
-- Einmalig im Supabase SQL Editor ausführen.
-- Neue Tabelle "kontakt" + security definer RPC "kontakt_senden".
-- Schreiben ausschließlich über die RPC (anon hat KEIN direktes INSERT).
-- Lesen für alle erlaubt (gleiches Muster wie forum "nachrichten"),
-- damit der Betreiber (Malarky) die Anfragen im Konto-Bereich sieht.

create table if not exists public.kontakt (
  id bigint generated always as identity primary key,
  name text not null,
  email text,
  betreff text,
  text text not null check (char_length(text) between 1 and 2000),
  erstellt_am timestamptz not null default now()
);

create index if not exists kontakt_erstellt_idx on public.kontakt (erstellt_am desc);

alter table public.kontakt enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'kontakt' and policyname = 'Jeder darf Kontakt lesen'
  ) then
    create policy "Jeder darf Kontakt lesen"
      on public.kontakt for select
      using (true);
  end if;
end $$;

-- Schreibfunktion: Anonymes Kontaktformular, kein Login nötig.
create or replace function public.kontakt_senden(
  p_name text,
  p_email text,
  p_betreff text,
  p_text text
)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if p_name is null or length(trim(p_name)) = 0 then
    raise exception 'Bitte einen Namen angeben.' using errcode = '23514';
  end if;
  if p_email is null or length(trim(p_email)) = 0 then
    raise exception 'Bitte eine E-Mail-Adresse angeben, damit wir antworten können.' using errcode = '23514';
  end if;
  if p_email !~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$' then
    raise exception 'Bitte eine gültige E-Mail-Adresse angeben.' using errcode = '23514';
  end if;
  if p_text is null or length(trim(p_text)) < 1 or length(trim(p_text)) > 2000 then
    raise exception 'Bitte eine Nachricht (1–2000 Zeichen) eingeben.' using errcode = '23514';
  end if;
  insert into public.kontakt (name, email, betreff, text)
  values (
    left(trim(p_name), 100),
    left(trim(p_email), 200),
    nullif(trim(coalesce(p_betreff, '')), ''),
    trim(p_text)
  );
end $$;

revoke insert, update, delete on table public.kontakt from anon, authenticated;

-- Löschen (nur Betreiber per RPC, da anon kein DELETE hat)
create or replace function public.kontakt_loeschen(p_id bigint)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  delete from public.kontakt where id = p_id;
end $$;

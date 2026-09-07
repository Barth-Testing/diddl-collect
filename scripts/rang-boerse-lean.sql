-- Diddl-Collect: schlanke Lese-RPCs für Rangliste + Tauschbörse (additiv)
-- ==============================================================================
-- Der Voll-Sync aller Profile (~2,6 MB) war der größte Egress-Posten. Diese
-- beiden Funktionen liefern NUR die Aggregate, die Rangliste und Börse
-- anzeigen – keine Passwörter, keine E-Mails, keine kompletten Sammlungen.
-- Zählregeln exakt wie Client (zaehle/normalisiereStatus): Arrays zählen per
-- Enthaltensein, Legacy-Strings ("own"/"wish"/"offer") zählen mit, ein
-- "offer" zählt immer auch als "own". Nur Lesen, kein Schreiben.
-- Rollback: drop function if exists public.lese_rangliste();
--           drop function if exists public.lese_boerse();

create or replace function public.lese_rangliste()
returns jsonb
language sql stable security definer set search_path = public, extensions
as $$
  with basis as (
    select p.id, p.name, coalesce(p.supporter, false) as supporter,
      case when jsonb_typeof(coalesce(p.statuses, '{}'::jsonb)) = 'object'
        then p.statuses else '{}'::jsonb end as st,
      case when jsonb_typeof(coalesce(p.beweise, '{}'::jsonb)) = 'object'
        then p.beweise else '{}'::jsonb end as bw
    from public.profile p
  )
  select coalesce(jsonb_agg(t), '[]'::jsonb) from (
    select b.id, b.name, b.supporter,
      (select count(*) from jsonb_each(b.st) s
        where s.value = '"own"'::jsonb or s.value = '"offer"'::jsonb
          or (jsonb_typeof(s.value) = 'array' and (s.value ? 'own' or s.value ? 'offer'))) as own,
      (select count(*) from jsonb_each(b.st) s
        where s.value = '"wish"'::jsonb
          or (jsonb_typeof(s.value) = 'array' and s.value ? 'wish')) as wish,
      (select count(*) from jsonb_each(b.st) s
        where s.value = '"offer"'::jsonb
          or (jsonb_typeof(s.value) = 'array' and s.value ? 'offer')) as offer,
      (select count(*) from jsonb_each(b.bw)) as beweise
    from basis b
  ) t
$$;

create or replace function public.lese_boerse()
returns jsonb
language sql stable security definer set search_path = public, extensions
as $$
  with basis as (
    select p.id, p.name,
      case when jsonb_typeof(coalesce(p.statuses, '{}'::jsonb)) = 'object'
        then p.statuses else '{}'::jsonb end as st,
      case when jsonb_typeof(coalesce(p.tausch, '{}'::jsonb)) = 'object'
        then p.tausch else '{}'::jsonb end as ta
    from public.profile p
  ),
  gez as (
    select b.id,
      (select count(*) from jsonb_each(b.st) s
        where s.value = '"own"'::jsonb or s.value = '"offer"'::jsonb
          or (jsonb_typeof(s.value) = 'array' and (s.value ? 'own' or s.value ? 'offer'))) as own,
      (select count(*) from jsonb_each(b.st) s
        where s.value = '"offer"'::jsonb
          or (jsonb_typeof(s.value) = 'array' and s.value ? 'offer')) as offer
    from basis b
  )
  select coalesce(jsonb_agg(t), '[]'::jsonb) from (
    select b.id as anbieter_id, b.name as anbieter_name, s.key as blatt_id,
      case when (b.ta -> s.key ->> 'betrag') ~ '^[0-9]+(\.[0-9]+)?$'
        then (b.ta -> s.key ->> 'betrag')::numeric end as betrag,
      nullif(b.ta -> s.key ->> 'notiz', '') as notiz,
      z.own, z.offer
    from basis b
    join jsonb_each(b.st) s
      on s.value = '"offer"'::jsonb
        or (jsonb_typeof(s.value) = 'array' and s.value ? 'offer')
    join gez z on z.id = b.id
  ) t
$$;

grant execute on function public.lese_rangliste() to anon;
grant execute on function public.lese_boerse() to anon;

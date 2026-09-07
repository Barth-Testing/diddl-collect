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
  aufgeschluesselt as (
    select b.id, b.name, s.key as blatt_schluessel, s.value as stand,
      b.ta -> s.key ->> 'betrag' as betrag_text,
      b.ta -> s.key ->> 'notiz' as notiz_text
    from basis b, jsonb_each(b.st) s
  ),
  gez as (
    select a.id,
      count(*) filter (where a.stand = '"own"'::jsonb or a.stand = '"offer"'::jsonb
        or (jsonb_typeof(a.stand) = 'array' and (a.stand ? 'own' or a.stand ? 'offer'))) as own,
      count(*) filter (where a.stand = '"offer"'::jsonb
        or (jsonb_typeof(a.stand) = 'array' and a.stand ? 'offer')) as offer
    from aufgeschluesselt a
    group by a.id
  )
  select coalesce(jsonb_agg(t), '[]'::jsonb) from (
    select a.id as anbieter_id, a.name as anbieter_name, a.blatt_schluessel as blatt_id,
      case when a.betrag_text ~ '^[0-9]+(\.[0-9]+)?$'
        then a.betrag_text::numeric end as betrag,
      nullif(a.notiz_text, '') as notiz,
      z.own, z.offer
    from aufgeschluesselt a
    join gez z on z.id = a.id
    where a.stand = '"offer"'::jsonb
      or (jsonb_typeof(a.stand) = 'array' and a.stand ? 'offer')
  ) t
$$;

grant execute on function public.lese_rangliste() to anon;
grant execute on function public.lese_boerse() to anon;

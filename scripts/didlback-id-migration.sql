-- Diddl-Collect: Alte Diddl-is-Back-Katalog-IDs auf neue IDs umziehen
-- ================================================================
-- Hintergrund: Der Katalog führt die Diddl-is-back-Blätter seit dem
-- 27.08.2026 unter neuen IDs ("diddlback-de-..." statt "A5-463" ...).
-- Nutzer-Zuordnungen (statuses, tausch, beweise, favoriten, beweis_fotos)
-- hängen noch an den alten Keys und wären dadurch im Web-Frontend
-- unsichtbar. Diese Migration verschiebt die Zuordnungen auf die neuen
-- IDs. Existiert unter der neuen ID bereits eine Zuordnung (dasselbe Blatt
-- doppelt markiert), bleibt die alte Zuordnung erhalten – nichts geht
-- verloren. Die App remappt die alten IDs zusätzlich beim Lesen (Fallback,
-- falls die Migration noch nicht ausgeführt wurde).
--
-- Einmalig im Supabase SQL Editor ausführen: Dashboard → SQL Editor →
-- New query → Run.

do $$
declare
  m record;
begin
  if to_regclass('public.profile') is null then
    raise notice 'Tabelle "profile" fehlt – Migration übersprungen.';
    return;
  end if;

  for m in
    select * from (values
      ('A5-463', 'diddlback-de-a5-004'),
      ('A5-464', 'diddlback-de-a5-003'),
      ('A5-465', 'diddlback-de-a5-006'),
      ('A5-466', 'diddlback-de-a5-005'),
      ('A5-467', 'diddlback-de-a5-001'),
      ('A5-468', 'diddlback-de-a5-002'),
      ('A6-229', 'diddlback-de-a6-005'),
      ('A6-230', 'diddlback-de-a6-006'),
      ('A6-231', 'diddlback-de-a6-002'),
      ('A6-232', 'diddlback-de-a6-003'),
      ('A6-233', 'diddlback-de-a6-004'),
      ('A6-234', 'diddlback-de-a6-001')
    ) as v(alt text, neu text)
  loop
    execute format(
      'update public.profile set statuses = (statuses - %L) || jsonb_build_object(%L, coalesce(statuses -> %L, statuses -> %L)) where statuses ? %L',
      m.alt, m.neu, m.neu, m.alt, m.alt
    );

    execute format(
      'update public.profile set tausch = (tausch - %L) || jsonb_build_object(%L, coalesce(tausch -> %L, tausch -> %L)) where tausch ? %L',
      m.alt, m.neu, m.neu, m.alt, m.alt
    );

    execute format(
      'update public.profile set beweise = (beweise - %L) || jsonb_build_object(%L, coalesce(beweise -> %L, beweise -> %L)) where beweise ? %L',
      m.alt, m.neu, m.neu, m.alt, m.alt
    );

    execute format(
      'update public.profile set favoriten = (favoriten - %L) || jsonb_build_object(%L, coalesce(favoriten -> %L, favoriten -> %L)) where favoriten ? %L',
      m.alt, m.neu, m.neu, m.alt, m.alt
    );
  end loop;

  if to_regclass('public.beweis_fotos') is not null then
    for m in
      select * from (values
        ('A5-463', 'diddlback-de-a5-004'),
        ('A5-464', 'diddlback-de-a5-003'),
        ('A5-465', 'diddlback-de-a5-006'),
        ('A5-466', 'diddlback-de-a5-005'),
        ('A5-467', 'diddlback-de-a5-001'),
        ('A5-468', 'diddlback-de-a5-002'),
        ('A6-229', 'diddlback-de-a6-005'),
        ('A6-230', 'diddlback-de-a6-006'),
        ('A6-231', 'diddlback-de-a6-002'),
        ('A6-232', 'diddlback-de-a6-003'),
        ('A6-233', 'diddlback-de-a6-004'),
        ('A6-234', 'diddlback-de-a6-001')
      ) as v(alt text, neu text)
    loop
      execute format(
        'update public.beweis_fotos b set blatt_id = %L where b.blatt_id = %L and not exists (select 1 from public.beweis_fotos z where z.profil_id = b.profil_id and z.blatt_id = %L)',
        m.neu, m.alt, m.neu
      );
      execute format(
        'delete from public.beweis_fotos b where b.blatt_id = %L and exists (select 1 from public.beweis_fotos z where z.profil_id = b.profil_id and z.blatt_id = %L)',
        m.alt, m.neu
      );
    end loop;
  end if;
end $$;

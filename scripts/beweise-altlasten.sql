-- Beweise-Fotos: verbliebene Inline-Bilder (dataURL-Strings) in die
-- beweis_fotos-Tabelle auslagern. Danach enthält profile.beweise nur noch
-- boolesche Marker – der Sync-Payload (Startseite, Konten-Cache) schrumpft
-- dadurch drastisch (ehemals ~1,2 MB komprimiert je Abruf).
-- Sicher & idempotent: kein Foto geht verloren (landet in beweis_fotos),
-- vorhandene Zeilen werden nicht überschrieben, erneut ausführen ist No-op.
-- Einmal im Supabase SQL Editor ausführen (Dashboard -> SQL Editor ->
-- New query -> Run).

do $$
declare
  p record;
  k text;
  v text;
  vorher text;
begin
  for p in select id, beweise from public.profile loop
    vorher := p.beweise::text;
    for k, v in
      select * from jsonb_each_text(p.beweise) where char_length(value) > 300
    loop
      if not exists (
        select 1 from public.beweis_fotos
        where profil_id = p.id and blatt_id = k
      ) then
        insert into public.beweis_fotos (profil_id, blatt_id, bild)
        values (p.id, k, v);
      end if;
      p.beweise := jsonb_set(p.beweise, Array[k]::text[], 'true'::jsonb);
    end loop;
    if p.beweise::text <> vorher then
      update public.profile set beweise = p.beweise where id = p.id;
    end if;
  end loop;
end $$;

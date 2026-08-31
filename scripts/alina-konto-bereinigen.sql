-- Diddl-Collect: Einzelfall-Bereinigung – leeres Konto "Alina" umbenennen
-- =========================================================================
-- Hintergrund: Es gibt zwei getrennte Konten – "Alina" (id u-1787685572265-xkvief,
-- angelegt 25.08., NUR Status-key own=0/wunsch=0/tausch=0/favoriten=0) und
-- "alina." (id u-1788180960-16f730, angelegt 31.08., mit den vollen Daten).
-- Da ein abschließender Punkt im Teilen-Link leicht abgeschnitten wird, zeigen
-- Links ohne Punkt fälschlich auf das leere "Alina".
--
-- Lösung (ohne Datenverlust): Das leere Konto bekommt einen eindeutigen Namen
-- "Alina.alt", sodass der exakte Name "Alina" frei wird und "alina." eindeutig
-- per Namensabgleich gefunden wird. Das Konto selbst bleibt erhalten (nur Name).
--
-- SICHERHEIT:
--   * Nur umbenennen, wenn das Konto tatsächlich leer ist (own/wunsch/tausch/
--     favoriten = 0). Ist es NICHT leer, wird die Umbenennung übersprungen.
--   * Kein neuer Kollisionsname: Es wird zuerst geprüft, dass "Alina.alt" noch
--     nicht vergeben ist (lower(name) unique).
--   * Das Konto kann sich weiterhin mit seinem Passwort anmelden (Name wird
--     serverseitig aus dem Konto abgeleitet; der Name ist in der Anmeldung
--     relevant, aber nach dem Login kommt der Name vom Konto).

begin;

-- 1) Prüfen & sichere Umbenennung (nur falls leer UND Zielname frei):
update public.profile
   set name = 'Alina.alt'
 where id = 'u-1787685572265-xkvief'
   and name = 'Alina'
   -- leer? alle Sammlungs-Felder und Status = 0:
   and (select count(*) from jsonb_each(statuses)) = 0
   and (select count(*) from jsonb_each(coalesce(favoriten,'{}'::jsonb))) = 0
   and (select count(*) from jsonb_each(coalesce(tausch,'{}'::jsonb))) = 0
   and (select count(*) from jsonb_each(coalesce(beweise,'{}'::jsonb))) = 0
   -- Zielname noch frei (case-insensitiv):
   and not exists (select 1 from public.profile where lower(name) = 'alina.alt' and id <> 'u-1787685572265-xkvief');

-- 2) Kontrolle: Zeigt, ob umbenannt wurde (0 Zeilen Rückgabe → nichts geändert).
select id, name,
       (select count(*) from jsonb_each(statuses)) as status_keys
from public.profile
where id in ('u-1787685572265-xkvief', 'u-1788180960-16f730')
order by lower(name);

commit;

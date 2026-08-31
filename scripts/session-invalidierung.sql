-- Diddl-Collect: Alte/inaktive Sessions einmalig aufräumen (älter als 5 Tage)
-- ===========================================================================
-- Zweck: Nach der Session-Härtung sollen verwaiste/alte Session-Tokens
-- aufgeräumt werden, ohne aktive Nutzer zu stören. Es werden NUR Sessions
-- gelöscht, deren letzte Aktivität mehr als 5 Tage zurückliegt. Aktuell
-- genutzte Sessions (frische letzte_aktivitaet) bleiben vollständig erhalten.
--
-- WARUM das Schutzziel trotzdem erfüllt ist:
--   * Der eigentliche Datenverlust-Schutz liegt im begleitenden Code-Fix:
--     Die App merged beim Login lokale Daten mit dem Server-Stand statt sie zu
--     überschreiben. Damit geht nichts verloren, selbst wenn eine Session
--     ausläuft und der Nutzer sich neu anmeldet.
--   * Dieses Skript räumt lediglich tote, >5 Tage inaktive Tokens auf.
--
-- SICHERHEIT:
--   * Es werden KEINE Profile/Galerien gelöscht – nur Sitzungs-Einträge.
--   * Betroffene (seit >5 Tagen inaktive) Nutzer müssen sich einmal neu
--     anmelden; dank des Merge-Fixes geht dabei nichts verloren.

-- Nur Sessions löschen, deren letzte Aktivität älter als 5 Tage ist.
-- (fällt bei fehlender Aktivität auf das Anlege-Datum zurück)
delete from public.sitzungen
where coalesce(letzte_aktivitaet, erstellt_am, now())
      < now() - interval '5 days';

-- Optional zur Kontrolle: Anzahl der verbleibenden (aktiven) Sessions.
-- select count(*) as verbleibende_aktive_sessions from public.sitzungen;

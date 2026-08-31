-- Diddl-Collect: Alle bestehenden Sessions einmalig invalidieren
-- =================================================================
-- Zweck: Nach der Session-Härtung sollen evtl. verwaiste/alte Sessions
-- (Session-Tokens) nicht weiter bestehen, damit niemand ohne aktive Verbindung
-- seine Galerie weiterpflegt. Durch das Löschen aller Session-Zeilen werden
-- sämtliche ausgestellten Tokens ungültig: Der nächste Schreib-/Lesezugriff
-- der App liefert Errortype 28000 → die App meldet den Nutzer aus und fordert
-- eine neue Anmeldung auf.
--
-- WARUM sicher?
--   * Es werden KEINE Profile/Galerien gelöscht – nur die Sitzungstabelle.
--   * Die App (nach dem begleitenden Code-Fix) merged beim nächsten Login die
--     lokalen Daten mit dem Server-Stand, statt sie zu überschreiben. Dadurch
--     geht nichts verloren, was lokal gepflegt, aber noch nicht hochgeladen war.
--     → Das SQL bitte NACH dem Deploy mit dem Code-Fix ausführen, nicht davor.
--   * Nutzer müssen sich danach einmal neu anmelden (einmalige Unannehmlichkeit).

delete from public.sitzungen;

-- Optional zur Kontrolle: zeigt, dass die Tabelle nun leer ist.
-- select count(*) as verbleibende_sessions from public.sitzungen;

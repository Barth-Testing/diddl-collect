-- Diddl-Collect: Lese-Rechte für anon reparieren (Sync-Fix)
-- =====================================================
-- Die App liest die Sammlungs-Spalten profile.blocks und profile.anzahl
-- direkt (Katalog, Rangliste, Sync). Durch eine frühere Column-Revoke waren
-- sie für anon gesperrt: Der direkte SELECT schlug mit 42501 fehl, und der
-- komplette Server-Sync lief dadurch ins Leere – nur die Login-RPC
-- (security definer) lieferte noch frische Daten. Darum erschienen fremde
-- Geräte-Markierungen erst nach einer Neuanmeldung.
--
-- Einmalig im Supabase SQL Editor ausführen: Dashboard → SQL Editor →
-- New query → Run. Idempotent. profile.email bleibt privat (gewollt).

grant select (blocks) on public.profile to anon;
grant select (anzahl) on public.profile to anon;

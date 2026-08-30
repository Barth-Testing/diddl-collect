-- Supporter-Status: Spender hervorheben (Rangliste + Profil + Spender-Übersicht)
-- Wird NICHT automatisch gesetzt – du meldest Spender manuell per UPDATE.
-- Idempotent, betrifft ausschließlich die genannten Konten.

alter table public.profile add column if not exists supporter boolean not null default false;

-- Diddl Nisimaus (erster Supporter) – Update per eindeutiger ID, damit das
-- Konto garantiert unangetastet bleibt (kein Platzhalter-Risiko bei Namen).
update public.profile set supporter = true where id = 'u-1788102574942-5737ow';

-- Weitere Spender künftig einfach so markieren:
--   update public.profile set supporter = true where lower(name) = lower('Name');

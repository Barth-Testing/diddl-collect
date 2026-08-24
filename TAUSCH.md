# Spezifikation: „Kater"-Korrektur & Tauschbörse mit Postfach

> Stand: 24.08.2026 · Diese Datei beschreibt VOR der Umsetzung, was gebaut wird und wie.
> Sie dient als Sicherung des Projektstands, falls die SSH-Verbindung abbricht.

---

## Teil 1 – Wortfehler „Kater" korrigieren

**Befund:** Diddl ist eine Maus, im News-Text steht aber „der kleine **Knuddelkater** ist also
tatsächlich zurück". Die einzige Fundstelle im gesamten Code ist der News-Starttext in
`scripts/supabase-schema.sql` (Zeile 143). Dieser Seed-Text wurde beim einmaligen Ausführen des
SQL-Skripts bereits in die Supabase-Tabelle `news` kopiert – ein Fix nur in der Datei ändert also
nicht die Live-Datenbank.

**Maßnahme:**

1. In `scripts/supabase-schema.sql`: `Knuddelkater` → `Knuddelmaus` (verhindert erneutes
   Einschleppen bei künftigen Seeds).
2. Dem Betreiber fertiges SQL zum manuellen Ausführen im Supabase-SQL-Editor mitgeben:

```sql
update public.news
set text = replace(text, 'Knuddelkater', 'Knuddelmaus')
where text like '%Knuddelkater%';
```

Ergebnis-Check danach: `select titel from public.news where text like '%Knuddelkater%';` → 0 Zeilen.

---

## Teil 2 – Tauschsystem

### Ist-Zustand (bleibt unverändert genutzt)

- Blätter können bereits als Status `"offer"` („Zum Tauschen") markiert sein
  (`profile.statuses` jsonb) – Zählung in `zaehle()`, Tab im Konto, Ring an der Blattkarte.
- Profile werden komplett client-seitig in einen localStorage-Cache synchronisiert
  (`src/lib/store.ts`, Muster siehe `favoriten`).

### Neuer Datenbestand

**A) Angebotsdetails pro Profil** – neue optionale Spalte `tausch` an `public.profile`
(jsonb, Default `{}`), Schlüssel = Blatt-ID:

```jsonc
{ "<blattId>": { "betrag": 12.5, "notiz": "Suche dafür A5-Motive aus 2004" } }
```

- `betrag`: Wunschbetrag in Euro, für den der Anbieter das Blatt (auch) hergeben würde. Optional.
- `notiz`: freier Wunschtext. Optional.
- Grund fürs Andocken am Profil statt eigener Tabelle: wiederverwendet die komplette bestehende
  Sync-Maschinerie (Merge, Offline-Push, RLS) exakt nach dem bewährten `favoriten`-Muster.

**B) Tauschangebote** – neue Tabelle `public.tauschangebot`:

| Spalte | Typ | Bedeutung |
| --- | --- | --- |
| id | text PK | client-generiert (`t-<zeit>-<zufall>`) |
| blatt_id | text | das angebotene („zum Tausch") Blatt |
| anbieter_id / anbieter_name | text / text | Profil des Anbieters |
| interessent_id / interessent_name | text / text | wer bietet |
| angebot_blatter | jsonb | Array von Blatt-IDs, die der Interessent dagegen bietet (mehrere erlaubt) |
| angebot_betrag | numeric null | Geldbetrag im Angebot |
| nachricht | text null | Begleittext des Erstangebots |
| status | text | `offen` \| `angenommen` \| `abgelehnt` \| `storniert` |
| erstellt_am / aktualisiert_am | timestamptz | Zeitstempel |

**C) Privates Postfach** – neue Tabelle `public.postnachrichten`:
`id bigint identity, angebot_id text, autor text, text text (1–500), erstellt_am timestamptz`.
Ein Thread = alle Nachrichten zu einer `tauschchangebot.id`. Realtime über `supabase_realtime`
(wie `nachrichten`), Index auf `(angebot_id, id)`.

RLS wie im restlichen Schema (Lesen/Schreiben offen – es gibt kein Supabase-Auth; Rollenprüfung
Anbieter/Interessent passiert client-seitig, konsistent zum bestehenden Vertrauensmodell).

### SQL (vom Betreiber manuell im SQL-Editor ausführen; Deploy darf vorher gehen)

```sql
alter table public.profile add column if not exists tausch jsonb not null default '{}'::jsonb;

create table if not exists public.tauschangebot (
  id text primary key,
  blatt_id text not null,
  anbieter_id text not null,
  anbieter_name text not null,
  interessent_id text not null,
  interessent_name text not null,
  angebot_blatter jsonb not null default '[]'::jsonb,
  angebot_betrag numeric,
  nachricht text,
  status text not null default 'offen',
  erstellt_am timestamptz not null default now(),
  aktualisiert_am timestamptz not null default now()
);
create index if not exists tauschangebot_anbieter_idx on public.tauschangebot (anbieter_id);
create index if not exists tauschangebot_interessent_idx on public.tauschangebot (interessent_id);
alter table public.tauschangebot enable row level security;
-- Policies Lesen/Anlegen/Aktualisieren/Löschen = true (Muster wie bei profile)

create table if not exists public.postnachrichten (
  id bigint generated always as identity primary key,
  angebot_id text not null,
  autor text not null,
  text text not null check (char_length(text) between 1 and 500),
  erstellt_am timestamptz not null default now()
);
create index if not exists postnachrichten_angebot_idx on public.postnachrichten (angebot_id, id);
alter table public.postnachrichten enable row level security;
-- Policies + realtime publication für beide Tabellen
```

### Abwärtskompatibilität (Live-Schutz)

- Spalte `tausch` ist überall optional (`ProfileRow.tausch?`), Normalisierung per `?? {}` in
  `loadUsers`/`zeileZuBenutzer`; `register()` setzt `{}`.
- SELECT-Aufbau dynamisch: bei `PGRST204`/`42703` werden optionale Spalten stufenweise
  weggelassen (`tauschUnterstuetzt`/`favoritenUnterstuetzt` Flags) und ohne sie wiederholt –
  App läuft auch VOR dem SQL-Einsatz weiter.
- Fehlen die neuen Tabellen, zeigen Tauschbörse/Postfach dezente Hinweise (Muster
  „Noch nicht eingerichtet" wie im Forum), Angebot-Erstellung wird blockiert; Rest der App
  unberührt.
- Keine destructive Migration, keine Änderung an Bestandstabellen außer `add column if not exists`.

### Neue Dateien

| Datei | Zweck |
| --- | --- |
| `src/lib/tausch.ts` | Datenschicht: Cache (localStorage), Sync, Realtime, Angebote erstellen/annehmen/ablehnen/stornieren, Post senden, Unread-Zähler, Offline-Warteschlange (Muster chat.ts) |
| `src/components/TauschDialog.tsx` | Dialog „Tauschangebot machen": eigene Blätter mehrfach wählbar (mit Suche) und/oder Geldbetrag, optionale Nachricht |
| `src/components/TauschboerseApp.tsx` | Globale Liste aller „zum Tausch"-Blätter aller Nutzer (Suche + Filter Größe/Farbe), Button → TauschDialog |
| `src/components/PostfachApp.tsx` | Private Threads: Angebotsübersicht, Chatverlauf, Aktionen (Annehmen/Ablehnen als Anbieter, Stornieren als Interessent) |
| `src/app/tausch/page.tsx`, `src/app/postfach/page.tsx` | Statische Routen (Export als `.html`) |

### Geänderte Dateien

| Datei | Änderung |
| --- | --- |
| `scripts/supabase-schema.sql` | Knuddelmaus-Fix + neuer Abschnitt Tausch (Spalte, 2 Tabellen, Policies, Realtime, Indizes) |
| `src/lib/types.ts` | `TauschInfo`-Typ, `Benutzer.tausch: Record<string, TauschInfo>` |
| `src/lib/store.ts` | Feld `tausch` nach Checkliste (ProfileRow, loadUsers, zeileZuBenutzer, register, syncMitServer-Merge/Vergleich, pushProfil inkl. Spalten-Fallback); neue Aktion `setzeTauschInfo()` |
| `src/components/Header.tsx` | Nav-Punkte „Tauschbörse" und „Postfach" (Postfach mit Unread-Badge als Client-Komponente, Labels mobil ausgeblendet wegen Platz) |
| `src/components/KontoApp.tsx` | Im Tab „Zum Tauschen": pro Karte Wunschbetrag + Notiz editierbar; beim Wegziehen des Tausch-Status wird die Info mitgeräumt |
| `src/components/SammlerProfilApp.tsx` | Abschnitt „Zum Tauschen angeboten" mit anklickbaren Karten → TauschDialog (fremdes Profil) bzw. Verwaltungshinweis (eigenes Profil) |
| `CHANGES.md` | Eintrag dokumentiert |

### Nutzerfluss (Endprodukt)

1. **Anbieter:** markiert Blatt im Konto als „Zum Tauschen" (existiert schon) und hinterlegt
   optional Wunschbetrag/Notiz (neu).
2. **Profil:** `/sammler?name=…` zeigt den Abschnitt „Zum Tauschen angeboten".
3. **Interessent:** klickt dort (oder in der Tauschbörse) auf ein Blatt → wählt eigene Blätter
   (mehrere möglich) und/oder Geldbetrag, schreibt optional eine Nachricht → Angebot geht raus.
4. **Postfach:** neues Angebot = neuer Thread; beide Seiten chatten privat; Anbieter nimmt an
   oder lehnt ab, Interessent kann stornieren. Header zeigt ungelesene Nachrichten.
5. **Tauschbörse:** `/tausch` listet ALLE Angebote aller Nutzer mit gleicher Mechanik,
   unabhängig vom Profil.

### Verifikation vor Abschluss

- `npm run lint` und `npm run build` müssen grün sein.
- Statischer Export: `out/tausch.html` und `out/postfach.html` vorhanden (grep-Inhaltstest).
- Alte Funktionen unangetastet: Katalog, Konto-Tabs, Rangliste (Punkteregel unberührt), Forum.

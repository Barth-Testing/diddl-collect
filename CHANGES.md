# Änderungslog

> Dieses Log wird bei jeder Änderung gepflegt (neuen Eintrag oben einfügen).
> Beim initialen Laden durchlesen, um den aktuellen Stand zu verstehen.

## 2026-08-31 — Namens-Verbot (Punkt) – Kollision „Alina“/„alina.“ über ID-Link

**Ziel:** Die Punkt-Kollision nachhaltig beheben (neue Fälle unmöglich; geteilte
Links eindeutig, auch wenn ein abschließender Punkt abgeschnitten wird).

**Befund:** `Alina` (u-1787685572265-xkvief) und `alina.` (u-1788180960-16f730)
sind **zwei echte, getrennte Konten mit eigenen Sammlungen** (Alina: 383
status_keys; alina.: 1037). Sie werden NICHT umbenannt oder zusammengeführt –
das wäre ein schwerer Eingriff in ein aktives Konto. Die Namens-Kollision wird
nicht per Datenänderung aufgelöst, sondern über eindeutige IDs beim Teilen.

- **Verbot in der Registrierung:** Namen, die mit einem Punkt enden, werden
  abgelehnt – im Client (`store.ts` `register`, schnelles Feedback) und in der
  DB-Funktion `registrieren` (`scripts/konto-haertung.sql`, source of truth,
  Errortype 23514). Verhindert künftig Punkt-Konten, die beim Teilen kollidieren.
- **ID-basierter Teilen-Link** (`sammlerLink(id, name)` → `?id=…&name=…&ht=1`):
  geteilte Links zeigen dank ID immer exakt auf das richtige Konto (`alina.`),
  selbst wenn der Punkt in der URL verloren geht. Bereits in Commit `237efb7`
  umgesetzt.
- **Lookup-Toleranz:** `SammlerProfilApp.tsx` ignoriert einen abschließenden
  Punkt beim Namensabgleich (als letzte Stufe nach exaktem Match). Da ein
  exaktes Konto `Alina` existiert, zeigt die mehrdeutige Hand-Eingabe
  `?name=alina` weiterhin exakt `Alina` – korrekt, weil nicht auflösbar. Für
  geteilte Links ist alles eindeutig.
- `scripts/alina-konto-bereinigen.sql` wurde **entfernt**: Es wäre ein Eingriff
  in ein echtes, gefülltes Konto (383 status_keys) gewesen und ist nicht anwendbar.

**Verifikation:** Build + Lint OK (nur vorbestehender Error in `SpendeButton.tsx`).

## 2026-08-31 — Datenverlust + Kollision „alina.“/„Alina“ + Session-Invalidierung

**Problembild (Support-Meldungen):**
- *alina.* teilt ihre Galerie; bei anderen werden nur einige Blätter gezeigt und
  Tausch/Wunsch/Favoriten stehen auf 0, obwohl bei ihr selbst alles stimmt.
- *Diddlsuchti* hat 217 Blätter gesammelt, sich ab-/angemeldet → danach war
  alles weg.

**Diagnose (DB + Live-Seite):**
- Es existieren **zwei getrennte Konten**: `Alina` (id `u-1787685572265-xkvief`,
  angelegt 25.08., leer) und `alina.` (id `u-1788180960-16f730`, angelegt 31.08.,
  volle Daten: 516 own / 521 wish / 159 offer / 49 favoriten). Sie sind bewusst
  getrennte Personen – NICHT zusammenführen (kein destruktiver Eingriff).
- Die Seite `?name=alina` (ohne Punkt) landete wegen exaktem Namens-Match auf dem
  leeren Konto `Alina` → daraus das „0 bei Tausch/Wunsch/Favoriten“-Symptom.
- Produktions-Supabase-Instanz: `pranagczstsmhekdrgdk` (im `out/`-Build bestätigt).
  Eine frühere SQL-Diagnose zeigte 0-Werte → Vermutung: anderes/leeres Projekt
  im SQL-Editor offen. Die Daten sind in der Produktions-DB vorhanden.

**Änderungen (Code):**
- `src/lib/store.ts` – `uebernimmAnmeldung`: überschreibt den lokalen Cache nicht
  mehr blind mit dem Server-Stand, sondern **mergt** lokale (evtl. noch nicht
  hochgeladene) Änderungen (statuses/beweise/favoriten/tausch) mit dem Server-
  Stand und lädt sie danach wieder hoch. Verhindert den Datenverlust beim
  Ab-/Anmelden (Diddlsuchti-Fall).
- `src/lib/utils.ts` – neue `sammlerLink(id, name)`: baut Teilen-Links robust,
  ohne dass ein abschließender Punkt am URL-Ende sitzt (`&ht=1`), und übergibt die
  eindeutige Konten-ID.
- `src/components/SammlerProfilApp.tsx` – Lookup bevorzugt die `id` (aus `?id=`),
  Namens-Fallback nur für alte Links; `teileProfil` nutzt `sammlerLink(id, name)`.
- `src/components/KontoApp.tsx` – `teileGalerie` nutzt `sammlerLink(id, name)`.

**SQL (vom Betreiber manuell im SQL-Editor auszuführen):**
- `scripts/session-invalidierung.sql` – löscht ALLE `sitzungen`-Zeilen → alle alten
  Session-Tokens ungültig (Errortype 28000 → App meldet aus, fordert Neu-Login).
  **WICHTIG:** erst nach dem Deploy mit dem Code-Fix ausführen, damit beim
  Neu-Login der lokale-Merge greift und nichts verloren geht.
- `scripts/diagnose-alina-name.sql` – Diagnose (rein lesend), zeigt die Konten.
- Manuell nicht zusammengeführt: `Alina` und `alina.` bleiben getrennte Konten.

**Verifikation:** `npm run lint` (nur vorbestehender Error in `SpendeButton.tsx`,
nicht von dieser Änderung) und `npm run build` laufen durch.

---

# Ideas
## Sorting in personal favorites
- the personal catalogue of owned papers is currently unsorted and shows items in the sorting they were clicked as liked
- The sorting mechanism should be minimal related to the id
- optional it could sortable by different parameters selectable via dropdown
- user can decide to display the predefined images or the selfmade proofs in the favorites catalog

## Carussel
- Besides the sorting of predefined images there should be an option to show a carussel of the images above the normal sorting
- This carussel shows the favorites of the corresponding user.
- It should be possible to see the carussel of other users on their regarding page too
- The user can select to display the predefined images or the selfmade proofs in the carussel

## Finding Spots map.
- 
- 

## Most likely account favorites
- displayed with special borders
- possibility to show a carussel only showing the most favorite pages on the profile page.

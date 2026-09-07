# Änderungslog

> Dieses Log wird bei jeder Änderung gepflegt (neuen Eintrag oben einfügen).
> Beim initialen Laden durchlesen, um den aktuellen Stand zu verstehen.

## 2026-09-07 — Egress: Boot-Sync 24 h + Fremdprofile lazy + Fotos in 24er-Schritten

**Ziel:** Tagesverbrauch (>200 MB) weiter Richtung 160-MB-Limit drücken. Drei
voneinander unabhängige, anzeigeneutrale Maßnahmen (kein SQL nötig).

- **`store.ts`:** `SYNC_TTL` 12 h → 24 h (halbiert die ~2,6-MB-Boot-Syncs).
  Neu `ladeFremdesProfil(id)`: lädt EINE Profilzeile nach (30-Min-Frische pro
  ID, In-Flight-Guard, unverändert-gerenderte Zeilen lösen kein Re-Render
  aus). Fremdzeilen werden plain ersetzt (dirty-Merge gehört nur dem eigenen
  Konto – Markier-Logik unberührt).
- **`SammlerProfilApp.tsx` / `TauschDialog.tsx`:** laden das betrachtete
  Fremdprofil bei Bedarf nach – Detailseiten bleiben trotz 24-h-TTL frisch.
- **`SammlerKarussell.tsx`:** Beweisfoto-Batches 60 → 24 (Button „nachladen“
  wie bisher). Kartenraster unverändert.
- Enthalten, aber noch ungepusht gewesen: News-Kompression + News-Bilder lazy
  (Startseite lädt keine MB mehr mit).

**Verifikation:** `tsc` sauber, Build OK; Lint nur vorbestehender
`SpendeButton.tsx`-Error.

## 2026-09-07 — News-Bilder lazy (Startseite lädt keine MB mehr mit)

**Ziel:** Die Startseite lud bis zu 50 News INKLUSIVE aller Data-URL-Bilder
bei jedem Besuch. Jetzt kommt die Liste nur noch als Text (KB), Bilder werden
pro sichtbarem Eintrag in einer Sammelabfrage nachgeladen.

- **`Neuigkeiten.tsx`:** Listen-Query ohne `bild`/`bild2` (Fallback-Kette
  entsprechend gekürzt, alle alten DB-Stände weiter abgedeckt); `ladeBilder()`
  lädt Bilder nur für sichtbare Einträge (`in`-Query); bei fehlenden Spalten
  (`PGRST204`/`42703`/`42501`) wird das Nachladen still abgeschaltet.
  Darstellung, Fallbacks und „Mehr anzeigen“ unverändert.

## 2026-09-07 — News-Bilder stärker komprimiert (Egress)

**Ziel:** News-Bilder landen als Data-URL in der DB und werden mit jeder
Startseite (bis 50 Einträge) mitgeladen – kleinere Bilder = weniger Egress.

- **`NewsSchreiben.tsx`:** Upload-Kompression 800 px/q0.7 → 640 px/q0.6
  (reicht für die Kartendarstellung, ca. ein Drittel bis die Hälfte kleiner).
- **Neu `scripts/news-bilder-diagnose.sql`:** zeigt gespeicherte
  Data-URL-Bilder nach Größe (nur Lesen). Zu große Alt-Bilder bei Bedarf per
  `update news set bild = null where id = …` entfernen und kleiner neu
  hochladen.

## 2026-09-07 — Hinweis-Button rechts unten (Admin schaltet Text/Link/An-Aus)

**Ziel:** Schwebender Hinweis-Button für eingeloggte Sammler (z. B. „Blöcke
verfügbar“), ohne Egress-Belastung und ohne Layout-Risiko (kein Lauftext).

- **DB (`scripts/hinweis.sql` – im SQL-Editor einspielen!):**
  - Mini-Tabelle `hinweis` (eine Zeile: text/link/aktiv), öffentlich lesbar.
  - `hinweis_setzen`-RPC (`security definer`, Admin-Check + Validierung).
- **`lib/hinweis.ts`:** Laden mit 10-Min-Cache (~100 Byte), Speichern per RPC,
  `PGRST202`-Fallback (Button bleibt dann unsichtbar).
- **`HinweisButton.tsx`:** global in `layout.tsx`, nur eingeloggt + aktiv +
  Text vorhanden (sonst rendert nichts), `bottom-40` über dem Spende-Button,
  interner/externer Link je nach URL.
- **`HinweisEditor.tsx`:** auf `/konto` für den Admin-Kreis (Text/Link/An-Aus).

**Verifikation:** Build OK; Lint nur vorbestehender `SpendeButton.tsx`-Error.
**DB-Deploy:** `scripts/hinweis.sql` im SQL-Editor ausführen (additiv).

## 2026-09-07 — Egress: Rangliste/Börse per Lean-RPCs + Chat-Delta (Voll-Sync entschärft)

**Ziel:** Der Voll-Sync aller Profile (~2,6 MB) war der größte Egress-Posten.
Rangliste und Börse lesen jetzt nur noch Aggregate (KB statt MB).

- **DB (`scripts/rang-boerse-lean.sql` – im SQL-Editor einspielen!):**
  - `lese_rangliste()` → pro Nutzer nur id/name/supporter/own/wish/offer/beweise.
  - `lese_boerse()` → pro Angebot nur blatt/anbieter/betrag/notiz/own/offer.
  - Beide `security definer`, read-only, Zählregeln exakt wie Client
    (`zaehle`/`normalisiereStatus`: Arrays per Enthaltensein, Legacy-Strings
    mitgezählt, `offer` zählt als `own`), keine sensiblen Spalten.
- **`store.ts`:** `ladeRanglisteRpc()`/`ladeBoerseRpc()` + Typen
  (`RangZeile`/`BoersenZeile`) + `berechneRanglisteAusZeilen()` (Punkte- und
  Sortiermathematik identisch zu `berechneRangliste`). `PGRST202` → Flag, dann
  alte Cache-Pfade (kein wiederholter Fehlversuch).
- **`RangApp.tsx`:** RPC-first; nur bei fehlender RPC noch `syncBeiBedarf()`.
  Darstellung (inkl. Supporter-Chips, „Du“-Markierung, 100-Punkte-Regel)
  unverändert. Detailseiten (Fremdprofile) folgen weiter dem Boot-Cache.
- **`TauschboerseApp.tsx`:** Gruppenaufbau aus RPC-Zeilen (`baueBoersenGruppen`,
  gleiche Sortierung/Dedup-/Filterlogik); ohne RPC alter Cache-Pfad.
  Markier- und Kauf-Logik unberührt.
- **`chat.ts`:** zweite ID-only-Query pro Raum gestrichen (IDs kamen schon aus
  der ersten Abfrage); Delta-Load (nur `id > max`, voller Abgleich max. alle
  30 Min pro Raum). Senden/Offline-Queue/Realtime unverändert.

**Verifikation:** Build OK; Lint nur vorbestehender `SpendeButton.tsx`-Error.
**DB-Deploy:** `scripts/rang-boerse-lean.sql` im SQL-Editor ausführen (additiv).
Ohne SQL läuft alles wie bisher (Fallback, kein Mehrverkehr außer je einem
fehlschlagenden RPC-Versuch pro Sitzung).

## 2026-09-07 — News-Rubrik: Admin-Check punkt-tolerant (Fix, live verifiziert)

**Befund:** Der News-Code war live im Bundle (per Live-Chunk verifiziert), die
Rubrik erschien trotzdem nicht. DB-Diagnose zeigt exakte Namen (`Malarky`,
`BloNdy`, keine Punkte/Dubletten) – darum zusätzlich: Rubrik steht jetzt auch
auf `/konto` (eigene Kontoseite), nicht nur auf `/sammler`. Verbleibender
Verdacht bei weiter fehlender Anzeige: veralteter Service Worker im Browser
(2× neu laden bzw. SW aktualisieren).

- **`kontakt.ts`:** neuer `normalisiereAdminName()` (trim + lower + End-Punkte
  weg, wie beim Profil-Lookup); `istAdmin()` nutzt ihn.
- **`SammlerProfilApp.tsx`:** Gate zeigt die Rubrik auch, wenn Session-ID und
  Profil-ID bei gleichem Admin-Namen auseinanderfallen (Legacy-Dubletten).
- **`scripts/news-schreiben.sql`:** Admin-Prüfung ebenfalls tolerant
  (`lower(rtrim(trim(name), '.'))`) – **erneut im SQL-Editor ausführen**,
  sonst lehnt die RPC Alt-Konten weiter mit `42501` ab.

**Verifikation:** Build OK; Lint nur vorbestehender `SpendeButton.tsx`-Error.

## 2026-09-07 — Tauschliste als PDF (Druck-Seite für Zum-Tauschen-Blätter)

**Ziel:** Wer auch auf anderen Plattformen tauscht, bekommt eine druckfertige
Liste aller „Zum Tauschen“-Blätter mit Bild und Konditionen.

- **Neu `src/app/tauschliste/page.tsx`:** Galerie aller `offer`-Blätter (Bild,
  Titel, Größe/Nr./Jahr/Farbe, Wunschbetrag, Notiz, Stückzahl), gruppiert wie
  im Verzeichnis, mit Name/Datum im Kopf. Button „Drucken / Als PDF speichern“
  nutzt `window.print()` (Browser erzeugt das PDF – keine neue Lib, kein
  CORS-Problem mit den hotlinked Katalogbildern, keine Artwork-Einbettung).
- **`KontoApp.tsx`:** Button „Tauschliste als PDF“ im Tausch-Tab (nur bei
  mind. 1 Tausch-Blatt), verlinkt auf `/tauschliste`.
- **Egress:** keiner – alle Daten liegen bereits auf dem Gerät (Profil-Sync +
  `blaetter.json`), keine neue Tabelle/RPC. Kein SQL nötig.

## 2026-09-07 — News per UI schreiben (Admin-Kreis malarky + blondy)

**Ziel:** News müssen nicht mehr per SQL eingetragen werden – der Admin-Kreis
schreibt sie direkt auf der eigenen Profilseite (`/sammler`).

- **DB (`scripts/news-schreiben.sql` – im SQL-Editor einspielen!):**
  - Spalten `bild`/`bild2`/`link` per `add column if not exists` abgesichert.
  - Neue `security definer`-Funktion `news_schreiben(p_token, p_titel, p_text,
    p_bild, p_link)`: Session prüfen (`28000`), **Admin serverseitig prüfen**
    (`lower(name) in ('malarky','blondy')`, sonst `42501` – Client-Name wird nie
    übernommen, kein Spoofing möglich), Längen prüfen (`23514`: Titel 1–120,
    Text 1–1000, Link ≤500, Bild ≤500 KB).
- **`kontakt.ts`:** `ADMIN_NAMEN = ["malarky", "blondy"]` + `istAdmin()`-Helper
  (immer case-insensitiv nutzen).
- **Neu `NewsSchreiben.tsx`:** Formular Titel/Text/Bild/Link, Bild per Canvas
  auf max 800 px (JPEG 0.7) verkleinert, Vorschau, Zähler, deutsche
  Erfolgs-/Fehlermeldungen, `PGRST202`-Fallback. Nur Schreiben, kein Löschen.
- **`SammlerProfilApp.tsx`:** Rubrik nur sichtbar, wenn der eingeloggte Admin
  seine eigene Seite ansieht (`ich.id === benutzer.id && istAdmin(...)`).
- **`KontoApp.tsx`:** `KontaktInbox`-Gate auf `istAdmin()` umgestellt (gilt
  damit auch für blondy).

**Verifikation:** Build OK; Lint nur vorbestehender `SpendeButton.tsx`-Error.
**DB-Deploy:** `scripts/news-schreiben.sql` im SQL-Editor ausführen (additiv).
Ohne SQL zeigt das Formular „noch nicht eingerichtet“.

## 2026-09-07 — Postfach-1 geräteübergreifend + Egress-Downshift (Lesestand in DB)

**Ziel:** Die „1“ am Brief verschwindet auf ALLEN Geräten, sobald ein Thread
geöffnet wurde (kein Geräte-Split mehr), neue Nachrichten zeigen sie weiterhin
an, und der Egress sinkt drastisch statt zu steigen.

- **DB (`scripts/post-lesestand.sql` – im SQL-Editor einspielen!):**
  - Neue Tabelle `post_lesestand (benutzer_id, angebot_id, gelesen_am)` – kein
    direkter Zugriff (revoke), nur über RPCs.
  - `post_gelesen(p_token, p_angebot_id)` – Thread als gelesen markieren
    (security definer, nur Teilnehmer, 42501 sonst).
  - `lese_ungelesene(p_token)` – Mini-RPC, liefert nur die **Thread-IDs** mit
    ungelesenen fremden Nachrichten (Bytes statt MB). Zählt wie der Client
    (autor != eigener Name, System-Diffs zählen, storniert/abgelehnt raus).
- **`tausch.ts`:**
  - `ladeUngelesen()` + `lesestandAktiv()`: Server-Lesestand-Spiegel
    (`diddlcollect:ungelesen-server`), Badge zählt geräteübergreifend.
  - `markiereGelesen` schreibt bei aktivem Server-Lesestand optimistisch in den
    Spiegel und feuert `post_gelesen` (Fallback alter localStorage-Pfad bleibt).
  - `ungeleseneThreadIds(ich)`: liefert die ungelesenen Thread-IDs für Badge UND
    Thread-Highlight.
  - **`ladeAlles` lädt nur noch die EIGENEN Threads** (`or(anbieter/interessent
    = ich)` + Posts per `in`), FRISCH-Check pro Nutzer (`tausch:frisch:<id>`).
    Kein globaler `select` mehr (500 Angebote + 2000 Posts waren die
    Egress-Bombe).
  - `verbindeTausch` lädt pro Nutzer-Konto nur einmal (Kontowechsel erneut).
- **`PostfachLink.tsx`:** Header-Badge ruft NIE mehr `verbindeTausch()` (=
  Vollload) auf, sondern pollt `lese_ungelesene` (60 s + Fokus/Sichtbarkeit).
  Nur wenn die RPC fehlt (DB-Migration noch nicht eingespielt), Fallback auf
  das alte Verhalten – nichts bricht vor dem SQL-Deploy.
- **`PostfachApp.tsx`:** Ungelesene Threads bekommen einen Peach-Punkt „1“ in der
  Thread-Liste; Sync läuft mit eigener ID (scoped).
- **`TauschboerseApp.tsx`:** `verbindeTausch()` entfernt – die Börse nutzt nur
  Profildaten, der bisherige Volldownload pro Besuch war reiner Egress-Verlust.

**Verifikation:** Build OK; Lint nur vorbestehender `SpendeButton.tsx`-Error.
**DB-Deploy:** `scripts/post-lesestand.sql` im SQL-Editor ausführen (additiv,
kein Rollback nötig für Altgeräte). Ohne SQL bleibt alles beim alten Verhalten.

## 2026-08-31 — Registrierung: Namensende nur mit Buchstabe/Ziffer (alle End-Sonderzeichen geblockt)

**Ziel:** Namens-Überschneidungen dauerhaft verhindern. Drei Ebenen greifen jetzt
zusammen, sodass künftig weder `Toni`/`toni`, noch `alina`/`alina.`, noch Namen,
die auf `? ! = “ ` ` und ähnliche URL-reservierte Zeichen enden, neu entstehen
können.

**Grund-Logik:** Ein Sammlername darf **nicht mit einem Sonderzeichen enden** – nur
mit einem Buchstaben oder einer Ziffer. Das deckt den Punkt ebenso ab wie `?`, `!`,
`=`, Anführungszeichen, Backtick, Komma u. v. m. Da geteilte Links ohnehin die ID
nutzen (`?id=…&name=…&ht=1`) und den Namen immer mit `encodeURIComponent` + `&ht=1`
abschließen, ist der Abschneide-Mechanismus für alle Anhänge neutralisiert; das
Verbot verhindert zusätzlich verwirrende „Link-Schrott“-Namen.

- **DB-Funktion `registrieren` (`konto-haertung.sql`):**
  - `trim(p_name) !~ '^.*[A-Za-z0-9äöüÄÖÜß]$'` → Endet der Name nicht auf einen
    Buchstaben oder eine Ziffer, wird abgelehnt (Errortype 23514).
  - Case-prüfung `lower(name) = lower(p_name)` (blockt `Toni`/`toni`, 23505).
  - End-Punkt-Variante `lower(rtrim(name,'.')) = lower(rtrim(p_name,'.'))`
    (blockt `alina` neben `alina.`, 23505).
  - Bestehende Konten (z. B. `alina.`) bleiben unangetastet.
- **Client (`store.ts` `register`):** Entsprechende Prüfungen für sofortiges
  Feedback; lokale/Demo-Pfade prüfen dieselben Bedingungen.

**Verifikation:** Build OK, Lint nur vorbestehender `SpendeButton.tsx`-Error.
**DB-Deploy:** `konto-haertung.sql` (mindestens die `registrieren`-Funktion) in der
Produktions-DB erneut ausführen, damit alle neuen Prüfungen aktiv sind.

## 2026-08-31 — Rangliste erzwingt frischen Server-Sync (neue Konten sofort sichtbar)

**Ziel:** Neu registrierte Konten (z. B. „alina.“) erscheinen in der Rangliste sofort
statt erst nach Ablauf des 12h-Cache-TTL (`SYNC_TTL`).

- **`store.ts`:** Neue Funktion `erzwingeSync()` – führt `syncMitServer()` sofort
  aus und ignoriert den 12h-TTL. Merge-Logik bleibt identisch (lokale Daten gehen
  nicht verloren, nur das eigene Konto wird hochgeladen) – kein Datenverlustrisiko.
- **`RangApp.tsx`:** Beim Öffnen der Rangliste wird `erzwingeSync()` aufgerufen;
  `useStoreVersion()` sorgt dafür, dass die Liste nach dem Sync neu rendert.
- Behebt das Symptom, dass ein veralteter lokaler Cache neue Konten bis zu 12h
  verbirgt (vorher nur über manuelles Cache-Löschen/Inkognito sichtbar).

**Verifikation:** Build OK, Lint nur vorbestehender `SpendeButton.tsx`-Error.

## 2026-08-31 — Rangliste & Tauschbörse: Klick-Links auf ID-Link umgestellt

**Ziel:** Auch Klicks aus der Rangliste und der Tauschbörse führen eindeutig auf
das richtige Sammlerprofil — nicht über den reinen Namen (der bei „alina.“ mit
abgeschnittenem Punkt kollidiert), sondern über die ID.

- **`RangApp.tsx`:** Namen-Spalte (Tabellenzeile, Zeile ~152) und Supporter-Chips
  nutzen jetzt `/sammler?id=…&name=…&ht=1` statt `/sammler?name=…`. Damit zeigt
  ein Klick auf „alina.“ exakt deren Konto, selbst wenn ein Messenger den Punkt
  abschneiden würde.
- **`TauschboerseApp.tsx`:** Anbieter-Link (Zeile ~198) auf denselben ID-Link
  umgestellt.
- Keine reinen `/sammler?name=`-Links für Profile mehr im Code (sammlerLink/ID
  überall, wo geklickt/geteilt wird).

**Verifikation:** Build OK, `out/rangliste.html` enthält keine reinen
`?name=`-Links mehr; Lint nur vorbestehender `SpendeButton.tsx`-Error.

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

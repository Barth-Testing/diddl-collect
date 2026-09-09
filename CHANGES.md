# Änderungslog

> Dieses Log wird bei jeder Änderung gepflegt (neuen Eintrag oben einfügen).
> Beim initialen Laden durchlesen, um den aktuellen Stand zu verstehen.

## 2026-09-09 — Log-Analyse: lese_ungelesene kaputt (42702) + Voll-Sync-Schleifen

**Befund (`logs/supabase_logs.csv`, 1000 Zeilen, 11:10–11:45 Uhr):**
- `lese_ungelesene` schlägt zu **100 %** fehl (22× POST → 400 + 22× postgres
  `42702 column reference "benutzer_id" is ambiguous`). Variable heißt wie die
  Spalte – je nach deployed Revision löst der Parser falsch auf. Folge: Der
  Postfach-Badge fällt auf `verbindeTausch()` **ohne eigeneId** (= GLOBAL:
  `tauschangebot limit=500` + Riesen-Posts-IN) zurück – im Fenster ~10 globale
  Loads à ~250–500 KB. `post_gelesen` wurde 0× aufgerufen (Lesestand nie aktiv).
- **15 volle Profil-Syncs** (~2,6 MB) in 35 Min, teils 3× in 2,5 Min vom selben
  Gerät. Verstärker: 2× PostgREST-Timeout („Thread killed by timeout manager“,
  1000er-Block zu groß) – nach Fehlschlag ist SYNCZEIT nie gesetzt, jeder neue
  Besuch lädt erneut voll.
- News-Bilder: 36 Queries/35 Min (~120 MB/Tag hochgerechnet) – nur per
  Storage+CDN lösbar (größeres Projekt, zurückgestellt).
- Kleinvieh: 19× 28000 (tote Sessions pollen ewig weiter), 16× anmelden-403 von
  einem Gerät (menschliche Fehlversuche, kein Loop).

**Fixes (Code, abwärtskompatibel):**
- **DB (`scripts/post-lesestand-fix.sql` – im SQL-Editor ausführen!):**
  `lese_ungelesene`/`post_gelesen` erst DROPPEN (räumt stille Überladungen weg),
  dann mit `v_`-Variablen + voll qualifizierten Spalten neu anlegen. Logik
  unverändert. Danach im Log: keine 400 auf `lese_ungelesene`, keine globalen
  `tauschangebot`-Downloads (ohne `or`-Filter) mehr.
- **`tausch.ts`/`PostfachLink.tsx`:** `ladeUngelesen()` meldet den Grund;
  neuer `lesestandNichtEingerichtet()` (nur PGRST202). Der Voll-Sync-Fallback
  läuft NUR noch bei fehlender Migration – und dann **scoped** (`eigeneId`).
  Bei kaputter RPC (400) bleibt der lokale Stand (kein Download-Sturm mehr).
- **`store.ts`:** `passwort` aus dem Sync-Select entfernt (~60–100 B × Zeilen
  gespart + keine Hashes mehr in fremden Caches); `SEITEN_GROESSE` 1000 → 250
  (keine PostgREST-Timeouts mehr, Bytes gleich); nach Fehlschlag 1 h kein neuer
  Voll-Sync (`diddlcollect:syncfehler`); 28000 im Eigen-Poll loggt aus (tote
  Sessions pollen nicht ewig).

**Verifikation:** `tsc` sauber, Build OK; Lint nur vorbestehender
`SpendeButton.tsx`-Error. Nach SQL-Deploy + Push im nächsten Log prüfen:
`lese_ungelesene` 200, `tauschangebot` nur noch mit `or`-Filter, Voll-Syncs mit
`limit=250`.

## 2026-09-09 — Katalog: neue Kategorie „Dänemark“ (Deense A6 + Spezial-Blätter)

**Ziel:** Dänische Sonderkollektion als eigener Modus im Katalog – 6 Deense-Blätter
(Oktober 2011, teils als Nr. 235–240 geführt) plus 4 Spezial-Blätter von Seite 1
des PDFs unter abweichender Benamung.

- **Neu `src/data/daenemark.json`** (compact, 10 Einträge, `kategorie: daenemark`):
  - Kollektion **Dänemark** (`daenemark-a6-001` … `-006`, Nummer 1–6, Jahr 2011,
    `name` D1–D6 suchbar) → Benamung `2011-Din A6-1 (Dänemark)` … wie immer.
  - Kollektion **Diddlina** (`daenemark-diddlina-01/02`, `Din A6-1 (Diddlina)` …)
    und **Käseblatt** (`daenemark-kaeseblatt-01/02`, `Din A6-1 (Käseblatt)` …) –
    Nummerierung beginnt je Kollektion neu (Muster wie Diddl-is-Back). Jahr
    unbekannt → `jahr: null` (Annahme, gern korrigieren).
- **Neu `public/daenemark/`:** 10 Bilder aus `SpecialeA6blaadjes.pdf`
  (Tabellenraster per Linienerkennung ausgeschnitten, Rand getrimmt, 270 px /
  q85 wie A5-463 ff., 15–35 KB) – statisch via Cloudflare, kein Supabase-Egress.
- **`blaetter.ts`:** `daenemark.json` in `BLAETTER`, neu
  `DAENEMARK_KOLLEKTIONEN`; `blattTitel` ohne Jahr → `Din A6-1 (Diddlina)`
  (trifft keine bestehenden Einträge – alle haben ein Jahr).
- **`KatalogApp.tsx`:** Modus-Button „Dänemark“ + Kollektions-Chips
  (Alle/Dänemark/Diddlina/Käseblatt); alle Filter (Größe/Farbe/Suche/Status/
  Block/Beweis) greifen wie in den anderen Modi. IDs sind neu und kollidieren
  nicht mit `ALTE_BLATT_IDS` – kein Remap nötig.
- Farben per Farbanalyse + Sichtkontrolle (u. a. erstmals `Grau` im Katalog).

## 2026-09-08 — Katalog: A5 Blätter 463-481 ergänzt (PDF-Import)

**Ziel:** Fehlende A5-Blätter 463-481 aus `DIN_A5_463_bis_481.pdf` ergänzen.
Die Blätter 457-462 waren bereits vorhanden; 463-481 fehlten komplett.

- **`src/data/blaetter.json`:** 19 Einträge `A5-463` … `A5-481` (Din A5, Jahr
  2006, Farben aus Bildanalyse, Quelle `diddl-verzamel-ik.nl`) – compact JSON,
  einheitliche Benamung `A5-<nummer>`, bestehende IDs bleiben stabil, alte
  Remap-IDs (`diddlback-de-a5-*`) dank katalogbewusstem Remap abgesichert.
- **`public/katalog/a5-463.jpg` … `a5-481.jpg`:** Bilder aus dem PDF extrahiert
  (via `pdfimages`), große Blätter auf 270px Breite skaliert (Qualität 85),
  kleine direkt übernommen – alle lokal unter `public/katalog` (kein Hotlink,
  keine Copyright-Verletzung, einheitlich wie `a6-229` …).
- Filter: Größe, Farbe, Jahr, Suche, Status, Block, Beweis greifen sofort –
  kein SQL nötig, kein Egress-Einfluss (statische Assets, Cloudflare-Cache).

## 2026-09-08 — Egress ohne Pro-Plan: Katalog-Zähler lean + Sync-TTL 7 Tage

**Ziel:** Unter 160 MB/Tag bleiben ohne Mehrkosten. Letzte heiße Stelle
(volle Profil-Caches für Zähler) beseitigt, Boot-Sync weiter gestreckt.

- **`KatalogApp.tsx`:** Tausch-Angebots-Zähler kommen per Lean-RPC
  (`lese_boerse`, 5-Min-Cache, katalogbewusst remappt) statt Voll-Cache-Scan;
  Fallback unverändert. Zähler sind dadurch sogar aktueller als bisher.
- **`store.ts`:** `SYNC_TTL` 48 h → 7 Tage (Boot-Voll-Sync nur noch wöchentlich
  pro Gerät). Abgedeckt: eigenes Konto per Mini-Poll, Rangliste/Börse/
  Katalog-Zähler per Lean-RPC, Fremdprofile per Lazy-Load, Supporter per
  Mount-Abgleich. Gelöschte Konten können bis zu 7 Tage als Kartei-Leiche
  sichtbar bleiben (selten, kosmetisch).
- Kein SQL nötig, keine Schreibpfad-Änderung.

## 2026-09-08 — Beweis-Filter (Alle/Mit/Ohne) in Katalog und Konto-Tabs

**Ziel:** Blätter zusätzlich nach Beweis-Status eingrenzen – parallel zu allen
anderen Filtern kombinierbar.

- **`KatalogApp.tsx` / `KontoApp.tsx`:** Dropdown „Alle Beweise / Mit Beweis /
  Ohne Beweis“ in den Filterzeilen (alle Modi/Tabs).
- Nur lokale Sitzungsdaten, kein Egress-, kein Sync-, kein DB-Einfluss.

## 2026-09-08 — Konto-Tabs: Katalog-Filter (Größe/Farbe/Suche) für die eigene Sammlung

**Ziel:** Im eigenen Profil gab es nur Sortierung – jetzt dieselben Filter wie
im Katalog (Größe, Farbe, Suche) in den Tabs Sammlung/Wunsch/Tausch.

- **`KontoApp.tsx`:** Suchfeld + Größe-/Farbe-Dropdowns in der Filterkarte
  (nur lokale Sitzungsdaten); Leer-Zustand unterscheidet „noch leer“ vs.
  „keine Treffer“ inkl. Zurücksetzen-Button.
- Kein Egress-, kein Sync-, kein DB-Einfluss.

## 2026-09-08 — Fehlende Profile: Sync paginiert + Direktlink lädt nach

**Befund:** Profil GlitziGlitz (u-1788773538-8042f3) wurde nicht mehr angezeigt.
Zwei Lücken gefunden: (1) Der Voll-Sync las ohne Limit/Sortierung (PostgREST
schneidet kommentarlos bei 1000 Zeilen ab) – wachsende Gemeinde = zufällig
fehlende Profile. (2) Seit RPC-first + langem TTL löst ein Direktlink auf ein
nicht-gecachtes Profil nie einen Abruf aus (Lazy-Load lief nur für bekannte
Profile).

- **`store.ts`:** `ladeProfileZeilen` lädt in stabil sortierten 1000er-Seiten
  (unter 1000 Zeilen exakt 1 Request wie bisher, kein Mehr-Egress);
  Schema-Fallback-Kaskade unverändert; Teilfehler → Sync wird verworfen statt
  halb gemergt.
- **`SammlerProfilApp.tsx`:** Direktlink (`?id=`) auf unbekanntes Profil lädt
  die eine Zeile nach (`ladeFremdesProfil`) – danach erscheint sie.
- **DB-Diagnose (falls Profil weiter fehlt):** Zeile prüfen per
  `select id, name, created_at from profile where id = '…';` – fehlt sie dort,
  wurde sie serverseitig gelöscht (kein Client-Problem).

## 2026-09-08 — Tandem-Überladung profil_patch entfernt (300er-Loop war Egress-Treiber)

**Befund (Log 24 h):** `profil_patch` antwortete Alt-Clients mit `300 Multiple
Choices` – `profil-patch-antwort.sql` hatte per `create or replace` mit neuer
Signatur (`+p_stand`) eine **zweite Überladung** angelegt statt zu ersetzen.
13-Argument-Calls treffen beide → 300 → Client-Retry ×3, dirty bleibt, alle
15 s erneut. Der Sturm im Log (mehrere Patches/Sekunde) kommt daher.

**Fix:** Alte 13-Param-Signatur per `drop function` entfernen (in
`profil-patch-antwort.sql` fest verdrahtet, Guardrail in AGENTS.md). Danach:
Alt-Clients → 200 mit voller Zeile (Verhalten wie vor dem Ack-Umbau, Storm
stoppt sofort), Neu-Clients → Ack (Bytes). Kein Code-Change nötig, kein Build.

## 2026-09-07 — Top-Spenderin NeleFranka (Supporter + Highlight)

**Ziel:** NeleFranka (bisherige Top-Spenderin) als Supporter markieren und in
der Ranglisten-Danksagung besonders hervorheben.

- **DB (im SQL-Editor ausführen):** `update public.profile set supporter = true
  where id = 'u-1788627590-de6c53';`
- **`RangApp.tsx`:** `TOP_SPENDER`-Liste (case-insensitiv); Eintrag bekommt in
  der Danke-Box Krone + goldenen Verlauf + „Top-Spenderin“-Badge. Rest
  unverändert, kein Egress-, kein Sync-Einfluss.

## 2026-09-07 — Katalog: zusätzlicher Block-Filter (parallel kombinierbar)

**Ziel:** Blätter lassen sich eingrenzen auf „hat Block-Markierung“ – additiv
zu „Hab ich“ und parallel mit allen anderen Filtern kombinierbar.

- **`KatalogApp.tsx`:** Toggle-Chip „Nur Block“ neben dem Status-Dropdown
  (emerald, passend zum Block-Chip der Karten); wirkt in allen Modi
  (Katalog/Diddl is Back/Forever/Relief/Pimboli) plus Kollektion/Generation/
  Größe/Farbe/Status/Suche. Legende um Block ergänzt.
- Nur lokale Sitzungsdaten, kein Egress, kein SQL nötig.

## 2026-09-07 — Egress-Haupttreiber: Patch-Antwort schlank + Stand-Handshake

**Ziel:** `profil_patch` (24k Calls/Tag) lieferte je die volle Profilzeile
zurück (~30–90 KB) plus danach nochmal per Eigen-Poll. Neu nur noch Bytes –
bei exakt gleicher Sync-Sicherheit (Cross-Device-Markieren uneingeschränkt,
kein Relogin-Szenario).

- **DB (`scripts/profil-patch-antwort.sql` – zuerst einspielen, dann Push!):**
  Neuer optionaler Param `p_stand`; bei Kollision (fremde Änderung seit Stand)
  volle Zeile wie bisher, sonst `{ok, aktualisiert_am}`. Beide Richtungen
  kompatibel (ohne `p_stand` immer voll; neue Clients gegen alte DB mergen
  `data.profil` wie bisher). Keine Grant-Änderungen.
- **DB (`scripts/rang-boerse-lean.sql` – erneut ausführen):** `lese_boerse`
  mengenbasiert (ein Durchlauf + `FILTER` statt korrelierter Subselects, gleiche
  Semantik) gegen die beobachteten 500er-Timeouts.
- **`store.ts`:** `pushProfil` sendet `p_stand`, übernimmt `aktualisiert_am`
  (kein redundanter Eigen-Poll-Download mehr); Merge-/Retry-/Fallback-Pfade
  unverändert; Zeitstempel-Hygiene bei Login/Logout (verhaltensneutral).
- **`tausch.ts`/`PostfachLink.tsx`:** `28000` beim Badge-Poll loggt aus wie
  überall (stoppt 400er-Spam toter Sessions); Voll-Download-Fallback nur noch
  bei fehlender Funktion (`PGRST202`).
- **`Neuigkeiten.tsx`:** `linkUnterstuetzt`-Flag (ein Fehlversuch, dann direkt
  Basis-Query).

**Verifikation:** `tsc` sauber, Build OK; Lint nur vorbestehender
`SpendeButton.tsx`-Error. Akzeptanz: A+B gleichzeitig markieren → Refresh ohne
Relogin → beide Markierungen überall (plus Alt-Client parallel).

## 2026-09-07 — Egress: RPC-Cache + Sync-TTL 48 h + News-Cache

**Ziel:** Tagesverbrauch weiter Richtung 160-MB-Limit drücken – diesmal über
Wiederholungsbesuche statt Einzelabfragen (kein SQL nötig).

- **`store.ts`:** `SYNC_TTL` 24 h → 48 h (Boot-Voll-Sync nur noch halb so oft;
  eigenes Konto weiter per Mini-Poll live, Rangliste/Börse per Lean-RPC live,
  Fremdprofile per Lazy-Load). Neu: 5-Min-Ergebnis-Cache für
  `lese_rangliste`/`lese_boerse` (`diddlcollect:rpc-cache`) – Kernseiten laden
  bei Wiederbesuch ohne Netzfrage.
- **`Neuigkeiten.tsx`:** News-Liste 5 Min + Gemeinde-Stats 10 Min gecacht
  (`diddlcollect:neuigkeiten`); `loescheNeuigkeitenCache()` als Export.
- **`NewsSchreiben.tsx`:** leert den News-Cache nach erfolgreichem Post –
  eigene News erscheint sofort, fremde max. 5 Min verzögert.

**Verifikation:** `tsc` sauber, Build OK; Lint nur vorbestehender
`SpendeButton.tsx`-Error.

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

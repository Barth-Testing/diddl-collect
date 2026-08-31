# Beweisfoto-Volumen — Beobachtung (2026-08-31)

> Live-Produktion. Kein akuter Handlungsbedarf — nur im Auge behalten,
> damit die Supabase-DB-Limits nicht gerissen werden.

## Befund (Diagnose in Produktions-DB `pranagczstsmhekdrgdk`)

| Metrik | Wert |
|---|---|
| Fotos in `beweis_fotos` | **2.450** |
| Gesamtgröße `beweis_fotos` | **50 MB** |
| Ø pro Foto | ~20 KB (Base64) |
| Altlasten in `profile.beweise` | **0** echte Bilder (nur `true`-Marker) |

- Beweisfotos sind bereits in die `beweis_fotos`-Tabelle ausgelagert
  (nicht mehr als Base64 in `profile.beweise` gespeichert).
- Der Client komprimiert Uploads bereits auf **max 320px, JPEG q0.6**
  (`KontoApp.tsx` `dateiGewaehlt` ≈ Zeile 138–147).

## Einordnung

- **50 MB ist aktuell klein** und deutlich unter den Supabase-DB-Grenzen
  (typischerweise 500 MB – mehrere GB je nach Tarif).
- Das Volumen wächst **linear** mit neuen Fotos/Nutzern.
- Da Fotos komprimiert gespeichert werden, ist die DB-Belastung primär
  durch die **Anzahl** der Fotos getrieben, nicht durch die einzelne Größe.

## Beobachtungspunkte / mögliche Maßnahmen (aufgeschoben — heute nicht nötig)

1. **Lade-Latenz statt DB-Größe:** Beim Öffnen eines Profils lädt `beweise.ts`
   (`ladeBeweisFotos`) **alle** Beweisfotos eines Nutzers gleichzeitig (kein
   Limit/Pagination). Nutzer mit 200+ Beweisen laden mehrere MB auf einmal.
   → Kandidat, wenn Profile mit vielen Beweisen spürbar langsam werden.
2. **Auflösung weiter senken** (z. B. 320→240px): spart nur ~10–15 MB bei vielen
   Fotos, verschlechtert aber die Erkennbarkeit der kleinen Diddl-Bildmotive —
   geringer Nutzen.
3. **Storage-Auslagerung:** Fotos nach Supabase Storage verschieben (nur URL in
   DB). Größerer Umbau (Backfill der 2.450 Fotos, RLS/Policies, Client-Umstellung).
   → Erst erwägen, wenn Größe Richtung Grenzwert wächst (mehrere hundert MB) oder
   die DB-Limits eng werden.

## Auslöser, um das Thema wieder aufzugreifen

- `beweis_fotos`-Größe wächst Richtung ~200–500 MB, **oder**
- Nutzer (v. a. mit vielen Beweisen) melden spürbar langsame Profil-Ladezeiten.

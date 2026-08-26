import { readFile, writeFile } from "node:fs/promises";
import { PNG } from "pngjs";

const PAGES = [];

function extrahiereBilder(html) {
  const treffer = html.match(/src="https:\/\/primary\.jwwb\.nl[^"]*image-high[^"]*"/g) ?? [];
  return [...new Set(treffer.map((m) => m.slice(5, -1).replaceAll("&amp;", "&")))];
}

async function ladeSeite(page) {
  try {
    const res = await fetch(page.url, { headers: { "user-agent": "Mozilla/5.0" } });
    if (res.ok) return await res.text();
    console.warn(`HTTP ${res.status} bei ${page.url} – nutze Cache.`);
  } catch (fehler) {
    console.warn(`Fetch fehlgeschlagen (${fehler.message}) – nutze Cache.`);
  }
  return readFile(page.cache, "utf8");
}

function klassifiziere(r, g, b) {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  if (max < 55 || d < 20) return null;
  const s = d / max;
  let h;
  if (max === r) h = ((g - b) / d) % 6;
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  h = (h * 60 + 360) % 360;
  if (h >= 14 && h < 66 && s < 0.45) return null;
  if (s < 0.16) return null;
  if (h < 14 || h >= 335) return "Rot";
  if (h < 38) return "Orange";
  if (h < 66) return "Gelb";
  if (h < 155) return "Grün";
  if (h < 195) return "Türkis";
  if (h < 260) return "Blau";
  if (h < 300) return "Lila";
  return "Rosa";
}

async function dominanteFarbe(url) {
  try {
    const res = await fetch(url, { headers: { "user-agent": "Mozilla/5.0" } });
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    const png = PNG.sync.read(buf);
    const { width, height, data } = png;
    const schritt = Math.max(1, Math.floor((width * height) / 20000));
    const zaehler = new Map();
    for (let i = 0; i < width * height; i += schritt) {
      const farbe = klassifiziere(data[i * 4], data[i * 4 + 1], data[i * 4 + 2]);
      if (!farbe) continue;
      zaehler.set(farbe, (zaehler.get(farbe) ?? 0) + 1);
    }
    let beste = null;
    let max = 0;
    for (const [farbe, anzahl] of zaehler) {
      if (anzahl > max) {
        max = anzahl;
        beste = farbe;
      }
    }
    return beste;
  } catch (fehler) {
    console.warn(`Farbanalyse fehlgeschlagen (${fehler.message}).`);
    return null;
  }
}

const datenPfad = new URL("../src/data/blaetter.json", import.meta.url);
if (PAGES.length === 0) {
  console.log("fetch:sammelverzeichnis ist deaktiviert – Diddl-is-back-Kollektionen werden jetzt aus src/data/diddl-back.json verwaltet.");
  process.exit(0);
}
const daten = JSON.parse(await readFile(datenPfad, "utf8"));
const bekannte = new Set(daten.map((e) => e.id));
const groesseIndex = (g) => (g === "Din A4" ? 0 : g === "Din A5" ? 1 : 2);
let hinzugefuegt = 0;

for (const page of PAGES) {
  const html = await ladeSeite(page);
  const bilder = extrahiereBilder(html);
  if (bilder.length === 0) throw new Error(`Keine Bilder gefunden auf ${page.url}`);
  for (let i = 0; i < bilder.length; i++) {
    const nummer = page.start + i;
    const kuerzel = page.groesse === "Din A5" ? "A5" : "A6";
    const id = `${kuerzel}-${String(nummer).padStart(3, "0")}`;
    if (bekannte.has(id)) {
      console.log(`Überspringe vorhandenes ${id}`);
      continue;
    }
    const bildUrl = bilder[i];
    const farbe = (await dominanteFarbe(bildUrl)) ?? "Unbekannt";
    daten.push({
      id,
      nummer,
      groesse: page.groesse,
      bild: bildUrl,
      bildGross: bildUrl.split("?")[0],
      name: null,
      farbe,
      jahr: JAHR,
      quelle: page.url,
    });
    hinzugefuegt++;
    console.log(`${id}: farbe=${farbe}`);
  }
}

daten.sort((a, b) => groesseIndex(a.groesse) - groesseIndex(b.groesse) || a.nummer - b.nummer);
await writeFile(datenPfad, JSON.stringify(daten));
console.log(`\n${hinzugefuegt} neue Blätter gespeichert. Gesamt: ${daten.length}`);

import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { PNG } from "pngjs";

const BILD_QUELLE = new URL("../Diddl_is_back_Bilder/", import.meta.url);
const BILD_ZIEL = new URL("../public/diddl-is-back/", import.meta.url);
const DATEN_JSON = new URL("../src/data/diddl-back.json", import.meta.url);
const BLAETTER_JSON = new URL("../src/data/blaetter.json", import.meta.url);

const KOLLEKTIONEN = [
  { dir: "erste_kollektion_ready", id: "fr", label: "Diddl is Back Frankreich", jahr: 2025 },
  { dir: "zweite_kollektion_ready", id: "mid", label: "Mid Edition" },
  { dir: "dritte_kollektion", id: "herz", label: "Herz Edition" },
  { dir: "vierte_kollektion_ready", id: "schul", label: "Back to School Edition" },
  { dir: "fuenfte_kollektion_ready", id: "de", label: "Diddl is Back Deutschland" },
  { dir: "limitierte_kollektion_ready", id: "limited", label: "Limited Deutschland" },
  { dir: "birthday_special_ready", id: "geb", label: "Sonderkollektion (Geburtstag)" },
  { dir: "2016_kollektion_ready", id: "forever", label: "Forever Edition 2016", kategorie: "forever", jahr: 2016 },
];

const AUSSCHLUSS = new Map([
  ["forever", new Set(["A4_15_Wenslijst.png", "A4_16_Lievelingsrecept.png"])],
]);

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

function dominanteFarbe(dateiPfad) {
  try {
    const png = PNG.sync.read(readFileSync(dateiPfad));
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
  } catch {
    return null;
  }
}

function parseDatei(dateiName) {
  const treffer = dateiName.match(/A([456])_(?:\w+_)?(\d+)/);
  if (!treffer) return null;
  const [_, groesseCode, nummer] = treffer;
  const groesse = groesseCode === "4" ? "Din A4" : groesseCode === "5" ? "Din A5" : "Din A6";
  return { groesse, nummer: Number(nummer) };
}

const blaetter = JSON.parse(await readFile(BLAETTER_JSON, "utf8"));
const vorher = blaetter.length;
const raus = blaetter.filter((b) => String(b.quelle).includes("diddl-sammelverzeichnis"));
const blaetterNeu = blaetter.filter((b) => !String(b.quelle).includes("diddl-sammelverzeichnis"));

let eintraege = [];
for (const koll of KOLLEKTIONEN) {
  const quellOrdner = new URL(koll.dir + "/", BILD_QUELLE);
  const zielOrdner = new URL(koll.id + "/", BILD_ZIEL);
  if (!existsSync(quellOrdner)) {
    console.warn(`Ordner fehlt: ${koll.dir}`);
    continue;
  }
  if (!existsSync(zielOrdner)) mkdirSync(zielOrdner, { recursive: true });
  for (const datei of readdirSync(quellOrdner).sort()) {
    if (!/\.(png|jpe?g|webp)$/i.test(datei)) continue;
    if (AUSSCHLUSS.get(koll.id)?.has(datei)) {
      const ziel = new URL(`${koll.id}/${datei}`, BILD_ZIEL);
      if (existsSync(ziel)) {
        console.log(`Entferne ausgeschlossenes Bild: ${koll.id}/${datei}`);
        rmSync(ziel);
      }
      continue;
    }
    const parsed = parseDatei(datei);
    if (!parsed) {
      console.warn(`Überspringe unlesbare Datei: ${koll.dir}/${datei}`);
      continue;
    }
    const zielDatei = `${koll.id}/${datei}`;
    if (!existsSync(new URL(zielDatei, BILD_ZIEL))) {
      copyFileSync(new URL(datei, quellOrdner), new URL(zielDatei, BILD_ZIEL));
    }
    const nummerText = String(parsed.nummer).padStart(3, "0");
    const id = `diddlback-${koll.id}-${parsed.groesse === "Din A4" ? "a4" : parsed.groesse === "Din A5" ? "a5" : "a6"}-${nummerText}`;
    eintraege.push({
      id,
      nummer: parsed.nummer,
      groesse: parsed.groesse,
      bild: `/diddl-is-back/${zielDatei}`,
      bildGross: `/diddl-is-back/${zielDatei}`,
      name: null,
      farbe: dominanteFarbe(readFileSync(new URL(zielDatei, BILD_ZIEL))) ?? "Weiß",
      jahr: koll.jahr ?? 2026,
      quelle: `Diddl is Back – ${koll.label}`,
      kategorie: koll.kategorie ?? "back",
      kollektion: koll.label,
      kollektionId: koll.id,
    });
  }
}

eintraege.sort((a, b) =>
  (a.kategorie === "forever" ? 1 : 0) - (b.kategorie === "forever" ? 1 : 0) ||
  (a.kollektionId ?? "").localeCompare(b.kollektionId ?? "") ||
  (a.groesse === "Din A4" ? 0 : a.groesse === "Din A5" ? 1 : 2) - (b.groesse === "Din A4" ? 0 : b.groesse === "Din A5" ? 1 : 2) ||
  a.nummer - b.nummer,
);

await writeFile(DATEN_JSON, JSON.stringify(eintraege));
await writeFile(BLAETTER_JSON, JSON.stringify(blaetterNeu));
console.log(`Entfernt (diddl-sammelverzeichnis): ${raus.length} | Katalog: ${vorher} → ${blaetterNeu.length}`);
console.log(`Diddl-back-Einträge: ${eintraege.length}`);

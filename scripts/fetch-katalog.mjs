#!/usr/bin/env node
/**
 * Holt den Diddl-Blätter-Katalog von diddl-exchange.de (A4, A5, A6),
 * analysiert die dominante Farbe jedes Thumbnails und schreibt
 * src/data/blaetter.json für die Sammler-App.
 *
 * Nutzung: npm run fetch:katalog
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import jpeg from "jpeg-js";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(DIR, "..", "src", "data", "blaetter.json");

const PAGES = [
  { id: "A4", url: "https://www.diddl-exchange.de/indey.php?lsCual=KatDi4", label: "Din A4", startYear: 1996 },
  { id: "A5", url: "https://www.diddl-exchange.de/indey.php?lsCual=KatDi5", label: "Din A5", startYear: 1997 },
  { id: "A6", url: "https://www.diddl-exchange.de/indey.php?lsCual=KatDi6", label: "Din A6", startYear: 1998 },
];

const BASE = "https://www.diddl-exchange.de/";

function decodeHtml(s) {
  return s
    .replace(/\+/g, " ")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/f%C3%BC/g, "ü")
    .replace(/f%C3%B6/g, "ö")
    .replace(/f%C3%A4/g, "ä")
    .replace(/%C3%9F/g, "ß")
    .replace(/%C3%BC/g, "ü")
    .replace(/%C3%B6/g, "ö")
    .replace(/%C3%A4/g, "ä")
    .replace(/%C3%9C/g, "Ü")
    .replace(/%C3%96/g, "Ö")
    .replace(/%C3%84/g, "Ä")
    .replace(/%2C/g, ",")
    .replace(/%21/g, "!");
}

async function fetchPage(url) {
  const res = await fetch(url, { headers: { "user-agent": "Mozilla/5.0 (compatible; DiddlCollect/1.0)" } });
  if (!res.ok) throw new Error(`${url} -> ${res.status}`);
  return res.text();
}

function parseCatalog(html) {
  const thumbs = [...html.matchAll(/<img src=(images\/th\/[A-Za-z0-9/]+\.(?:jpg|jpeg|png))/g)].map(
    (m) => m[1],
  );
  const numbers = [...html.matchAll(/<font size=4 color=blue>(\d+)<\/td>/g)].map((m) => parseInt(m[1], 10));
  const names = new Map();
  for (const m of html.matchAll(/'(\d+)','([^']+)','meta\d+'/g)) {
    names.set(parseInt(m[1], 10), decodeHtml(m[2]).trim());
  }
  return { thumbs, numbers, names };
}

// Dominante Farbe eines JPEGs -> Kategorie (Motiv statt Papierhintergrund)
const BINS = [
  { name: "Rot", h: [340, 360], sMin: 0.45 },
  { name: "Rot", h: [0, 20], sMin: 0.45 },
  { name: "Orange", h: [20, 45], sMin: 0.4 },
  { name: "Gelb", h: [45, 70], sMin: 0.35 },
  { name: "Grün", h: [70, 160], sMin: 0.3 },
  { name: "Türkis", h: [160, 190], sMin: 0.3 },
  { name: "Blau", h: [190, 250], sMin: 0.3 },
  { name: "Lila", h: [250, 290], sMin: 0.3 },
  { name: "Rosa", h: [290, 340], sMin: 0.3 },
];

function rgbToHsv(r, g, b) {
  const max = Math.max(r, g, b) / 255;
  const min = Math.min(r, g, b) / 255;
  const d = max - min;
  let h = 0;
  if (d !== 0) {
    if (max === r / 255) h = ((g / 255 - b / 255) / d) % 6;
    else if (max === g / 255) h = (b / 255 - r / 255) / d + 2;
    else h = (r / 255 - g / 255) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  return { h, s: max === 0 ? 0 : d / max, v: max };
}

function classifyPixel(r, g, b) {
  const { h, s, v } = rgbToHsv(r, g, b);
  if (v < 0.18) return null;
  if (v > 0.9 && s < 0.22) return "bg";
  if (s < 0.12 && v > 0.6) return "bg";
  for (const bin of BINS) {
    if (s >= bin.sMin && v >= 0.22 && (bin.h[0] < bin.h[1] ? h >= bin.h[0] && h < bin.h[1] : h >= bin.h[0] || h < bin.h[1])) {
      return bin.name;
    }
  }
  return null;
}

const CATEGORY_ORDER = ["Weiß", "Cremig", "Gelb", "Orange", "Rosa", "Rot", "Lila", "Blau", "Türkis", "Grün", "Braun", "Bunt"];

async function dominantColor(url) {
  try {
    const res = await fetch(url, { headers: { "user-agent": "Mozilla/5.0" } });
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    const img = jpeg.decode(buf, { useTArray: true, formatAsRGBA: true });
    const counts = new Map();
    let fg = 0;
    let total = 0;
    let bgSat = 0;
    let bgSatN = 0;
    const step = Math.max(1, Math.floor(img.width / 48));
    for (let y = 0; y < img.height; y += step) {
      for (let x = 0; x < img.width; x += step) {
        const i = (y * img.width + x) * 4;
        const c = classifyPixel(img.data[i], img.data[i + 1], img.data[i + 2]);
        total++;
        if (c === "bg") {
          const { s } = rgbToHsv(img.data[i], img.data[i + 1], img.data[i + 2]);
          bgSat += s;
          bgSatN++;
          continue;
        }
        if (c) {
          fg++;
          counts.set(c, (counts.get(c) ?? 0) + 1);
        }
      }
    }
    if (fg < Math.max(4, total * 0.08)) {
      return bgSatN > 0 && bgSat / bgSatN > 0.09 ? "Cremig" : "Weiß";
    }
    let best = { name: "Bunt", n: 0 };
    for (const [name, n] of counts) if (n > best.n) best = { name, n };
    if (best.n / fg < 0.38) return "Bunt";
    return best.name;
  } catch {
    return null;
  }
}

const YEAR_RANGE = { A4: [1996, 2005], A5: [1997, 2006], A6: [1998, 2006] };

async function main() {
  const blätter = [];
  for (const page of PAGES) {
    process.stdout.write(`\n== ${page.label} (${page.id}) ==\n`);
    const html = await fetchPage(page.url);
    const { thumbs, numbers, names } = parseCatalog(html);
    if (!thumbs.length) {
      process.stdout.write(`  WARNUNG: keine Thumbnails auf ${page.url}\n`);
      continue;
    }
    const total = thumbs.length;
    const [y0, y1] = YEAR_RANGE[page.id];
    let done = 0;
    for (let i = 0; i < total; i++) {
      const num = numbers[i] ?? i + 1;
      const id = `${page.id}-${String(num).padStart(3, "0")}`;
      const thumb = `${BASE}${thumbs[i]}`;
      const sizeKey = page.id === "A4" ? "4" : page.id === "A5" ? "5" : "6";
      const gross = `${BASE}images/fs/bloA${sizeKey}/blo${sizeKey}${String(num).padStart(4, "0")}.jpg`;
      const color = (await dominantColor(thumb)) ?? "Unbekannt";
      const name = names.get(num) ?? null;
      const year = Math.round(y0 + (i / Math.max(1, total - 1)) * (y1 - y0));
      blätter.push({ id, nummer: num, groesse: page.label, bild: thumb, bildGross: gross, name, farbe: color, jahr: year, quelle: page.url });
      process.stdout.write(`\r  ${page.id}: ${i + 1}/${total}  (${color})`);
      done++;
    }
    process.stdout.write(`\n  ${done} Einträge, ${names.size} Namen\n`);
  }
  blätter.sort((a, b) => a.groesse.localeCompare(b.groesse) || a.nummer - b.nummer);
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(blätter, null, 0));
  const farben = [...new Set(blätter.map((b) => b.farbe))].sort(
    (a, b) => CATEGORY_ORDER.indexOf(a) - CATEGORY_ORDER.indexOf(b),
  );
  process.stdout.write(`\nGesamt: ${blätter.length} Blätter\nFarben: ${farben.join(", ")}\n`);
  process.stdout.write(`Geschrieben: ${OUT}\n`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
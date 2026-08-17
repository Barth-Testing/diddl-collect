import { deflateSync } from "node:zlib";
import { writeFileSync } from "node:fs";

const BREITE = 1200;
const HOEHE = 630;
const FARBE_OBEN = [249, 103, 156];
const FARBE_UNTEN = [255, 222, 236];
const HERZ_WEISS = [255, 255, 255];

function crc32(buf) {
  let c, crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = (crc ^ buf[i]) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = (crc >>> 8) ^ c;
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(typ, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(typ, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function inHerz(x, y) {
  const u = x * 1.9, v = y * 2.1;
  const f = (u * u + v * v - 1) ** 3 - u * u * v ** 3;
  return f <= 0;
}

let seed = 1337;
function rand() {
  seed = (seed * 1103515245 + 12345) % 2147483648;
  return seed / 2147483648;
}

const herzen = [];
for (let i = 0; i < 26; i++) {
  const g = 28 + rand() * 62;
  herzen.push({ cx: 20 + rand() * (BREITE - 40), cy: 20 + rand() * (HOEHE - 40), g, deckkraft: 0.35 + rand() * 0.5 });
}

const sup = 2;
const px = Buffer.alloc(BREITE * HOEHE * 4);
for (let y = 0; y < HOEHE; y++) {
  const t = y / HOEHE;
  const bg = FARBE_OBEN.map((v, i) => v + (FARBE_UNTEN[i] - v) * t);
  for (let x = 0; x < BREITE; x++) {
    let rosaAnteil = 0;
    for (const h of herzen) {
      const abstand = Math.hypot(x - h.cx, y - h.cy);
      if (abstand > h.g * 3.2) continue;
      let deckung = 0;
      for (let sy = 0; sy < sup; sy++) {
        for (let sx = 0; sx < sup; sx++) {
          const hx = (x + (sx + 0.5) / sup - h.cx) / h.g;
          const hy = (y + (sy + 0.5) / sup - h.cy) / h.g;
          if (inHerz(hx, hy)) deckung++;
        }
      }
      const a = deckung / (sup * sup);
      rosaAnteil = Math.min(1, rosaAnteil + a * h.deckkraft);
    }
    const i = (y * BREITE + x) * 4;
    for (let c = 0; c < 3; c++) {
      px[i + c] = Math.round(bg[c] + (HERZ_WEISS[c] - bg[c]) * rosaAnteil);
    }
    px[i + 3] = 255;
  }
}

const scanlines = Buffer.alloc(HOEHE * (BREITE * 4 + 1));
for (let y = 0; y < HOEHE; y++) {
  scanlines[y * (BREITE * 4 + 1)] = 0;
  px.copy(scanlines, y * (BREITE * 4 + 1) + 1, y * BREITE * 4, (y + 1) * BREITE * 4);
}
const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(BREITE, 0);
ihdr.writeUInt32BE(HOEHE, 4);
ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

writeFileSync("public/og-image.png", Buffer.concat([sig, chunk("IHDR", ihdr), chunk("IDAT", deflateSync(scanlines, { level: 9 })), chunk("IEND", Buffer.alloc(0))]));
console.log("public/og-image.png erzeugt (1200x630)");
import { deflateSync } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";

const CANDY = [249, 103, 156];
const WEISS = [255, 255, 255];

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

function png(groesse) {
  const sup = 4;
  const px = Buffer.alloc(groesse * groesse * 4);
  for (let y = 0; y < groesse; y++) {
    for (let x = 0; x < groesse; x++) {
      let deckung = 0;
      for (let sy = 0; sy < sup; sy++) {
        for (let sx = 0; sx < sup; sx++) {
          const u = (x + (sx + 0.5) / sup) / groesse;
          const v = (y + (sy + 0.5) / sup) / groesse;
          if (inHerz(u - 0.5, 0.5 - v)) deckung++;
        }
      }
      const a = deckung / (sup * sup);
      const i = (y * groesse + x) * 4;
      px[i] = Math.round(CANDY[0] + (WEISS[0] - CANDY[0]) * a);
      px[i + 1] = Math.round(CANDY[1] + (WEISS[1] - CANDY[1]) * a);
      px[i + 2] = Math.round(CANDY[2] + (WEISS[2] - CANDY[2]) * a);
      px[i + 3] = 255;
    }
  }
  const scanlines = Buffer.alloc(groesse * (groesse * 4 + 1));
  for (let y = 0; y < groesse; y++) {
    scanlines[y * (groesse * 4 + 1)] = 0;
    px.copy(scanlines, y * (groesse * 4 + 1) + 1, y * groesse * 4, (y + 1) * groesse * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(groesse, 0);
  ihdr.writeUInt32BE(groesse, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  return Buffer.concat([sig, chunk("IHDR", ihdr), chunk("IDAT", deflateSync(scanlines, { level: 9 })), chunk("IEND", Buffer.alloc(0))]);
}

mkdirSync("public", { recursive: true });
for (const [name, size] of [["icon-192.png", 192], ["icon-512.png", 512], ["apple-touch-icon.png", 180]]) {
  writeFileSync(`public/${name}`, png(size));
  console.log(`public/${name} erzeugt (${size}x${size})`);
}
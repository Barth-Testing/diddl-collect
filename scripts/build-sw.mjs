import { createHash } from "node:crypto";
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";

function alleDateien(dir) {
  const out = [];
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) out.push(...alleDateien(p));
    else out.push(p);
  }
  return out;
}

const outDir = "out";
const staticDir = join(outDir, "_next", "static");
const assets = alleDateien(staticDir)
  .map((p) => p.slice(outDir.length).replaceAll("\\", "/"))
  .sort();
if (!assets.length) {
  console.error("Keine _next/static Assets gefunden – Skript nach dem Build ausführen.");
  process.exit(1);
}

const hash = createHash("sha256").update(assets.join("\n")).digest("hex").slice(0, 8);
/* Idempotent: funktioniert sowohl mit frischem Template (__VERSION__ /
 * __ASSETS__) als auch mit bereits gebauten Werten aus einem früheren Lauf. */
let sw = readFileSync("public/sw.js", "utf8")
  .replace(/const VERSION = "[^"]*";/, `const VERSION = "v${hash}";`)
  .replace('"__VERSION__"', `"v${hash}"`);
const assetListe = assets.map((a) => JSON.stringify(a)).join(",\n  ");
if (sw.includes("/* __ASSETS__ */")) {
  sw = sw.replace("/* __ASSETS__ */", assetListe);
} else {
  sw = sw.replace(/const PRECACHE_URLS = \[[\s\S]*?\];/, `const PRECACHE_URLS = [\n  ${assetListe}\n];`);
}

writeFileSync("public/sw.js", sw);
writeFileSync(join(outDir, "sw.js"), sw);
console.log(`sw.js generiert (${assets.length} Assets, Version v${hash})`);

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
const sw = readFileSync("public/sw.js", "utf8")
  .replace("__VERSION__", "v" + hash)
  .replace("/* __ASSETS__ */", assets.map((a) => JSON.stringify(a)).join(",\n  "));

writeFileSync("public/sw.js", sw);
writeFileSync(join(outDir, "sw.js"), sw);
console.log(`sw.js generiert (${assets.length} Assets, Version v${hash})`);

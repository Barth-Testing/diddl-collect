import rohDaten from "../data/blaetter.json";
import diddlBackRoh from "../data/diddl-back.json";
import reliefRoh from "../data/relief.json";
import pimboliRoh from "../data/pimboli.json";
import { FARBREIHENFOLGE, type Benutzer, type Blatt } from "./types";

export const BLAETTER: Blatt[] = [...(rohDaten as Blatt[]), ...(diddlBackRoh as Blatt[]), ...(reliefRoh as Blatt[]), ...(pimboliRoh as Blatt[])];

export const PIMBOLI_GENERATIONEN: { id: string; label: string }[] = [
  { id: "gen1", label: "Gen 1 · 2002" },
  { id: "gen2", label: "Gen 2 · 2003" },
  { id: "gen3", label: "Gen 3 · 2003" },
  { id: "gen4", label: "Gen 4 · 2003" },
  { id: "gen5", label: "Gen 5 · 2003" },
  { id: "gen6", label: "Gen 6 · 2003" },
  { id: "gen7", label: "Gen 7 · 2004" },
  { id: "gen8", label: "Gen 8 · 2004" },
  { id: "gen9", label: "Gen 9 · 2004" },
  { id: "gen10", label: "Gen 10 · 2004" },
];

export const DIDDLBACK_KOLLEKTIONEN: { id: string; label: string }[] = [
  { id: "fr", label: "Diddl is Back Frankreich" },
  { id: "mid", label: "Mid Edition" },
  { id: "herz", label: "Herz Edition" },
  { id: "schul", label: "Back to School Edition" },
  { id: "de", label: "Diddl is Back Deutschland" },
  { id: "limited", label: "Limited Deutschland" },
  { id: "geb", label: "Sonderkollektion (Geburtstag)" },
];

export const BLAETTER_NACH_ID = new Map(BLAETTER.map((b) => [b.id, b]));

export const VERFÜGBARE_FARBEN = FARBREIHENFOLGE.filter((f) =>
  BLAETTER.some((b) => b.farbe === f),
);

export function farbBadge(farbe: string) {
  const map: Record<string, string> = {
    Weiß: "bg-white text-ink-700 ring-1 ring-cream-300",
    Cremig: "bg-cream-100 text-ink-700 ring-1 ring-cream-300",
    Gelb: "bg-yellow-100 text-yellow-800",
    Orange: "bg-orange-100 text-orange-800",
    Rosa: "bg-pink-100 text-pink-700",
    Rot: "bg-red-100 text-red-700",
    Lila: "bg-purple-100 text-purple-800",
    Blau: "bg-sky-100 text-sky-800",
    Türkis: "bg-teal-100 text-teal-800",
    Grün: "bg-green-100 text-green-800",
    Braun: "bg-amber-100 text-amber-800",
    Grau: "bg-stone-200 text-stone-700",
    Unbekannt: "bg-cream-200 text-ink-700",
    Bunt: "bg-gradient-to-r from-pink-100 via-violet-100 to-sky-100 text-ink-800",
  };
  return map[farbe] ?? map.Unbekannt;
}

/** Einheitliche Benamung aller Blätter: <Jahr>-<DIN-Größe>-<Nummer>.
 *  Bei Diddl-is-Back-Sammlungen wird die Kollektion ergänzt, weil dort die
 *  Nummerierung je Kollektion neu beginnt (sonst gäbe es Dopplungen).
 *  Pimboliblätter heißen <Jahr>-Pimboli-<Motivcode> (z. B. 2002-Pimboli-m1.1).
 *  Reliefblätter haben weder Jahr noch DIN-Größe: Relief-<Nummer>. */
export function blattTitel(blatt: Blatt): string {
  if (blatt.kategorie === "relief") return `Relief-${blatt.nummer}`;
  if (blatt.kategorie === "pimboli" && blatt.code) {
    const basis = blatt.jahr ? `${blatt.jahr}-Pimboli-${blatt.code}` : `Pimboli-${blatt.code}`;
    return blatt.kollektion ? `${basis} (${blatt.kollektion})` : basis;
  }
  const basis = `${blatt.jahr}-${blatt.groesse}-${blatt.nummer}`;
  return blatt.kollektion ? `${basis} (${blatt.kollektion})` : basis;
}

/** Sammlungs-Übersicht: Blöcke (markiert), eigene Blätter (ohne Relief),
 *  eigene Reliefblätter und Exemplare gesamt (inkl. Mehrfach-Stückzahlen). */
export function uebersichtSammlung(benutzer: Benutzer) {
  const { statuses, anzahl, blocks } = benutzer;
  let blaetter = 0;
  let reliefs = 0;
  let exemplare = 0;
  for (const [id, statusListe] of Object.entries(statuses)) {
    if (!statusListe.includes("own")) continue;
    const blatt = BLAETTER_NACH_ID.get(id);
    if (blatt?.kategorie === "relief") reliefs++;
    else blaetter++;
    exemplare += anzahl?.[id] ?? 1;
  }
  return {
    bloecke: Object.keys(blocks ?? {}).length,
    blaetter,
    reliefs,
    exemplare,
  };
}

export type SammlungSortierung =
  | "id"
  | "nummer"
  | "name"
  | "jahr-auf"
  | "jahr-ab"
  | "groesse"
  | "farbe"
  | "zuletzt";

export function sortiereSammlung<T extends { blatt: Blatt }>(liste: T[], modus: SammlungSortierung): T[] {
  const sortiert = [...liste];
  const nachId = (a: T, b: T) => a.blatt.id.localeCompare(b.blatt.id);
  switch (modus) {
    case "zuletzt":
      return sortiert;
    case "nummer":
      sortiert.sort((a, b) => a.blatt.nummer - b.blatt.nummer || nachId(a, b));
      break;
    case "name":
      sortiert.sort((a, b) => blattTitel(a.blatt).localeCompare(blattTitel(b.blatt), "de", { numeric: true }));
      break;
    case "jahr-auf":
      sortiert.sort((a, b) => (a.blatt.jahr ?? 0) - (b.blatt.jahr ?? 0) || a.blatt.nummer - b.blatt.nummer || nachId(a, b));
      break;
    case "jahr-ab":
      sortiert.sort((a, b) => (b.blatt.jahr ?? 0) - (a.blatt.jahr ?? 0) || a.blatt.nummer - b.blatt.nummer || nachId(a, b));
      break;
    case "groesse": {
      const groesseIndex = (g: string) => (g === "Din A4" ? 0 : g === "Din A5" ? 1 : 2);
      sortiert.sort((a, b) => groesseIndex(a.blatt.groesse) - groesseIndex(b.blatt.groesse) || nachId(a, b));
      break;
    }
    case "farbe": {
      const farbIndex = (f: string) => {
        const i = FARBREIHENFOLGE.indexOf(f as (typeof FARBREIHENFOLGE)[number]);
        return i === -1 ? 99 : i;
      };
      sortiert.sort((a, b) => farbIndex(a.blatt.farbe) - farbIndex(b.blatt.farbe) || nachId(a, b));
      break;
    }
    default:
      sortiert.sort(nachId);
  }
  return sortiert;
}
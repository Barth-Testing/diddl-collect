import rohDaten from "../data/blaetter.json";
import { FARBREIHENFOLGE, type Blatt } from "./types";

export const BLAETTER: Blatt[] = rohDaten as Blatt[];

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

export function nameOderNummer(blatt: Blatt) {
  return blatt.name ?? `Blatt Nr. ${blatt.nummer}`;
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
      sortiert.sort((a, b) =>
        (a.blatt.name ?? `zzz${a.blatt.nummer}`).localeCompare(b.blatt.name ?? `zzz${b.blatt.nummer}`),
      );
      break;
    case "jahr-auf":
      sortiert.sort((a, b) => a.blatt.jahr - b.blatt.jahr || a.blatt.nummer - b.blatt.nummer || nachId(a, b));
      break;
    case "jahr-ab":
      sortiert.sort((a, b) => b.blatt.jahr - a.blatt.jahr || a.blatt.nummer - b.blatt.nummer || nachId(a, b));
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
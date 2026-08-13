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
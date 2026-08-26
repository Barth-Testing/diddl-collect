export type Blatt = {
  id: string;
  nummer: number;
  groesse: "Din A4" | "Din A5" | "Din A6";
  bild: string;
  bildGross: string;
  name: string | null;
  farbe: string;
  jahr: number;
  quelle: string;
};

export const GROESSEN = ["Din A4", "Din A5", "Din A6"] as const;
export type Groesse = (typeof GROESSEN)[number];

export const FARBREIHENFOLGE = [
  "Weiß",
  "Cremig",
  "Gelb",
  "Orange",
  "Rosa",
  "Rot",
  "Lila",
  "Blau",
  "Türkis",
  "Grün",
  "Braun",
  "Grau",
  "Bunt",
] as const;

export type Status = "own" | "wish" | "offer";

export type TauschInfo = {
  betrag?: number;
  notiz?: string;
};

export const ALLE_STATI: readonly Status[] = ["own", "wish", "offer"];

/**
 * Migriert Altbestände: Vor dem Parallel-Update war pro Blatt nur EIN Status
 * gespeichert (ein String). Jetzt sind mehrere Stati gleichzeitig erlaubt
 * (z. B. "Hab ich" UND "Zum Tauschen"). Ein altes "offer" wird logisch zu
 * own+offer (tauschen setzt Besitz voraus) hochgestuft.
 */
export function normalisiereStatus(roh: unknown): Status[] {
  if (Array.isArray(roh)) {
    const liste = [...new Set(roh.filter((s): s is Status => (ALLE_STATI as readonly string[]).includes(s as string)))];
    if (liste.includes("offer") && !liste.includes("own")) liste.push("own");
    return liste;
  }
  if (roh === "offer") return ["own", "offer"];
  if (roh === "own") return ["own"];
  if (roh === "wish") return ["wish"];
  return [];
}

export function normalisiereStatuses(roh: Record<string, unknown> | null | undefined): Record<string, Status[]> {
  const out: Record<string, Status[]> = {};
  if (!roh) return out;
  for (const [id, wert] of Object.entries(roh)) {
    const liste = normalisiereStatus(wert);
    if (liste.length > 0) out[id] = liste;
  }
  return out;
}

export type Benutzer = {
  id: string;
  name: string;
  passwort: string;
  createdAt: number;
  statuses: Record<string, Status[]>;
  beweise: Record<string, string | boolean>;
  favoriten: Record<string, boolean>;
  tausch: Record<string, TauschInfo>;
};

export type Produkt = {
  asin: string;
  title: string;
  price: number;
  currency: string;
  imageUrl: string;
  rating: number | null;
  reviews: number | null;
  affiliateUrl: string;
};

export type ShopDaten = {
  marketplace: string;
  tag: string;
  generatedAt: string;
  products: Produkt[];
};

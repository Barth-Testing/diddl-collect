export type Blatt = {
  id: string;
  nummer: number;
  groesse: "Din A4" | "Din A5" | "Din A6" | "Relief";
  bild: string;
  bildGross: string;
  name: string | null;
  farbe: string;
  jahr: number | null;
  quelle: string;
  kategorie?: string;
  kollektion?: string;
  kollektionId?: string;
};

export const GROESSEN = ["Din A4", "Din A5", "Din A6", "Relief"] as const;
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
    if (liste.length > 0) out[aktuelleBlattId(id)] = liste;
  }
  return out;
}

/**
 * Alte Katalog-IDs der Diddl-is-Back-Sammelverzeichnis-Einträge, die am
 * 27.08.2026 unter neue diddlback-<kollektion>-IDs umgezogen sind. Die
 * Benutzer-Zuordnungen (statuses/tausch/beweise/favoriten) hängen in der DB
 * und in alten localStorage-Caches noch an den alten Keys – ALLE Lese-Pfade
 * remappen sie auf die aktuelle Katalog-ID, damit nichts unsichtbar wird.
 * Neue ID = gleiches Blatt (Motiv-Paarung visuell verifiziert).
 */
export const ALTE_BLATT_IDS: Record<string, string> = {
  "A5-463": "diddlback-de-a5-004",
  "A5-464": "diddlback-de-a5-003",
  "A5-465": "diddlback-de-a5-006",
  "A5-466": "diddlback-de-a5-005",
  "A5-467": "diddlback-de-a5-001",
  "A5-468": "diddlback-de-a5-002",
  "A6-229": "diddlback-de-a6-005",
  "A6-230": "diddlback-de-a6-006",
  "A6-231": "diddlback-de-a6-002",
  "A6-232": "diddlback-de-a6-003",
  "A6-233": "diddlback-de-a6-004",
  "A6-234": "diddlback-de-a6-001",
};

export function aktuelleBlattId(id: string): string {
  return ALTE_BLATT_IDS[id] ?? id;
}

export function remappeBlattSchluessel<T>(roh: Record<string, T> | null | undefined): Record<string, T> {
  if (!roh) return {};
  const out: Record<string, T> = {};
  for (const [id, wert] of Object.entries(roh)) out[aktuelleBlattId(id)] = wert;
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
  /** "Block besessen" je Blatt – der ganze Produktionsblock mit dem Blatt. */
  blocks: Record<string, boolean>;
  /** Stückzahl je Blatt (Mehrfach-Exemplare für den Tausch); fehlt = 1. */
  anzahl: Record<string, number>;
  /** Spender/Unterstützer – wird NUR serverseitig gesetzt (SQL), nie vom Client. */
  supporter?: boolean;
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

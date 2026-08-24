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

export type Benutzer = {
  id: string;
  name: string;
  passwort: string;
  createdAt: number;
  statuses: Record<string, Status>;
  beweise: Record<string, string>;
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

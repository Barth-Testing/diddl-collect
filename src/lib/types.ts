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
  "Bunt",
] as const;

export type Status = "own" | "wish" | "offer";
export type StatusKey = "own" | "wish" | "offer";

export type Benutzer = {
  id: string;
  name: string;
  passwort: string;
  createdAt: number;
  demo?: boolean;
  statuses: Record<string, Status>;
  beweise: Record<string, string>;
};

export const STATUS_LABEL: Record<Status, string> = {
  own: "Hab ich",
  wish: "Wunsch",
  offer: "Zum Tauschen",
};
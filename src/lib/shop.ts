import type { Produkt, ShopDaten } from "@/lib/types";
import shopDaten from "@/data/shop.json";

const daten = shopDaten as ShopDaten;

export function getShopDaten(): ShopDaten {
  return daten;
}

export function getProdukte(): Produkt[] {
  return daten.products;
}

export function formatPreis(preis: number, waehrung: string): string {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: waehrung,
  }).format(preis);
}

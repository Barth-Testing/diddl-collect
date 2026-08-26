import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Info, ShoppingBag } from "lucide-react";
import { ProduktKarte } from "@/components/ProduktKarte";
import { getProdukte, getShopDaten } from "@/lib/shop";

export const metadata: Metadata = {
  title: "Diddl-Shop – Schöne Diddl-Sachen bei Amazon",
  description:
    "Unsere Diddl-Funde bei Amazon: Backbuch, Malbücher, Zeichenbuch und mehr für echte Diddl-Fans. Mit Affiliate-Link direkt zu Amazon.",
};

export default function ShopSeite() {
  const produkte = getProdukte();
  const { tag, marketplace } = getShopDaten();

  return (
    <main className="mx-auto max-w-6xl px-4 py-10">
      <div className="flex items-center gap-3">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-peach-100 text-peach-500">
          <ShoppingBag className="h-6 w-6" />
        </div>
        <div>
          <h1 className="font-display text-2xl font-bold text-ink-800 sm:text-3xl">
            Diddl-Funde bei Amazon
          </h1>
          <p className="text-sm font-semibold text-ink-600">
            Schöne Sachen für echte Diddl-Blätter-Fans – von uns ausgesucht
          </p>
        </div>
      </div>

      <div className="mt-6 flex items-start gap-3 rounded-2xl bg-cream-100 p-4 text-sm text-ink-700 ring-1 ring-cream-200">
        <Info className="mt-0.5 h-5 w-5 shrink-0 text-candy-500" />
        <p>
          Diese Seite nimmt am Amazon-Partnerprogramm teil. Wenn du über einen der Links etwas bei
          Amazon ({marketplace}, Partner-Tag{" "}
          <code className="rounded bg-white px-1.5 py-0.5 text-xs font-bold text-candy-600">
            {tag}
          </code>
          ) kaufst, erhalten wir eine kleine Provision – für dich ändert sich am Preis nichts. Alle
          Preise sind Momentaufnahmen von Amazon.
        </p>
      </div>

      <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {produkte.map((p) => (
          <ProduktKarte key={p.asin} produkt={p} />
        ))}
      </div>

      <div className="mt-10 text-center">
        <Link
          href="/"
          className="chip gap-1.5 bg-white px-5 py-2.5 text-candy-600 ring-2 ring-candy-200 transition hover:bg-candy-100"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Zurück zur Startseite
        </Link>
      </div>
    </main>
  );
}

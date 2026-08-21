import type { Produkt } from "@/lib/types";
import { formatPreis } from "@/lib/shop";
import { ShoppingBag, Star } from "lucide-react";

export function ProduktKarte({ produkt }: { produkt: Produkt }) {
  return (
    <article className="card-soft group flex flex-col overflow-hidden transition-transform duration-300 hover:-translate-y-1">
      <a
        href={produkt.affiliateUrl}
        target="_blank"
        rel="noopener noreferrer sponsored"
        className="flex flex-1 flex-col"
      >
        <div className="relative aspect-square overflow-hidden bg-white p-4">
          {/* eslint-disable-next-line @next/next/no-img-element -- static export: remote Amazon images, no next/image loader */}
          <img
            src={produkt.imageUrl}
            alt={produkt.title}
            loading="lazy"
            className="size-full object-contain transition-transform duration-300 group-hover:scale-105"
          />
        </div>
        <div className="flex flex-1 flex-col gap-2 p-4">
          <h3 className="font-display line-clamp-2 min-h-[2.5rem] text-sm font-bold text-ink-800">
            {produkt.title}
          </h3>
          <div className="mt-auto flex flex-wrap items-center justify-between gap-2">
            <span className="font-display text-lg font-bold text-candy-600">
              {formatPreis(produkt.price, produkt.currency)}
            </span>
            {produkt.rating !== null && (
              <span className="flex items-center gap-1 text-xs font-bold text-ink-700">
                <Star className="h-3.5 w-3.5 fill-peach-400 text-peach-400" />
                {produkt.rating.toLocaleString("de-DE")}
                {produkt.reviews !== null && (
                  <span className="font-semibold text-ink-600">
                    ({produkt.reviews.toLocaleString("de-DE")})
                  </span>
                )}
              </span>
            )}
          </div>
          <span className="chip mt-1 justify-center gap-2 bg-candy-500 px-3 py-2 text-white transition-colors group-hover:bg-candy-600">
            <ShoppingBag className="h-3.5 w-3.5" />
            Auf Amazon ansehen
          </span>
        </div>
      </a>
    </article>
  );
}

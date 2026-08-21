"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { Produkt } from "@/lib/types";
import { ProduktKarte } from "./ProduktKarte";

export function ShopKarusell({ produkte }: { produkte: Produkt[] }) {
  const bahnRef = useRef<HTMLDivElement>(null);
  const [kannVor, setKannVor] = useState(false);
  const [kannZurueck, setKannZurueck] = useState(false);

  const aktualisierePfeile = useCallback(() => {
    const bahn = bahnRef.current;
    if (!bahn) return;
    setKannZurueck(bahn.scrollLeft > 4);
    setKannVor(bahn.scrollLeft < bahn.scrollWidth - bahn.clientWidth - 4);
  }, []);

  useEffect(() => {
    aktualisierePfeile();
    const bahn = bahnRef.current;
    if (!bahn) return;
    let zeit: ReturnType<typeof setTimeout>;
    const beobachter = new ResizeObserver(() => {
      clearTimeout(zeit);
      zeit = setTimeout(aktualisierePfeile, 100);
    });
    beobachter.observe(bahn);
    return () => {
      beobachter.disconnect();
      clearTimeout(zeit);
    };
  }, [aktualisierePfeile, produkte.length]);

  const schiebe = (richtung: 1 | -1) => {
    const bahn = bahnRef.current;
    if (!bahn) return;
    const karte = bahn.querySelector<HTMLElement>("[data-karte]");
    const breite = karte ? karte.offsetWidth + 16 : 288;
    bahn.scrollBy({ left: richtung * breite, behavior: "smooth" });
  };

  return (
    <div className="relative">
      <div
        ref={bahnRef}
        onScroll={aktualisierePfeile}
        className="no-scrollbar -mx-1 flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-smooth px-1 pb-2"
      >
        {produkte.map((p) => (
          <div
            key={p.asin}
            data-karte
            className="w-[calc(100%-1.5rem)] shrink-0 snap-start sm:w-[calc(50%-0.5rem)] md:w-[calc(33.333%-0.75rem)] lg:w-[calc(25%-0.75rem)]"
          >
            <ProduktKarte produkt={p} />
          </div>
        ))}
      </div>

      {kannZurueck && (
        <button
          type="button"
          aria-label="Zurück"
          onClick={() => schiebe(-1)}
          className="absolute top-1/2 -left-4 z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white text-candy-600 shadow-lg ring-1 ring-candy-100 transition hover:bg-candy-500 hover:text-white"
        >
          <ChevronLeft className="h-6 w-6" />
        </button>
      )}
      {kannVor && (
        <button
          type="button"
          aria-label="Weiter"
          onClick={() => schiebe(1)}
          className="absolute top-1/2 -right-4 z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white text-candy-600 shadow-lg ring-1 ring-candy-100 transition hover:bg-candy-500 hover:text-white"
        >
          <ChevronRight className="h-6 w-6" />
        </button>
      )}
    </div>
  );
}

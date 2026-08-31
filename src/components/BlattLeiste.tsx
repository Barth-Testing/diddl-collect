"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { BLAETTER_NACH_ID, blattTitel } from "@/lib/blaetter";
import { cn } from "@/lib/utils";

export type BlattKnopfStil = "gruen" | "rosa";

type Props = {
  ids: string[];
  knopfStil?: BlattKnopfStil;
  aufBlatt?: (id: string) => void;
  knopfText?: string;
  zusatz?: (id: string) => string | null;
  leerText?: string;
};

/** Horizontal scrollbare Blatt-Spange mit sichtbaren Pfeiltasten (auch für Maus)
 *  und „Mehr anzeigen“-Ausklappfunktion – fürs Sammlerprofil. */
export function BlattLeiste({ ids, knopfStil, aufBlatt, knopfText, zusatz, leerText }: Props) {
  const bahnRef = useRef<HTMLDivElement>(null);
  const [kannVor, setKannVor] = useState(false);
  const [kannZurueck, setKannZurueck] = useState(false);
  const [alle, setAlle] = useState(false);

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
  }, [aktualisierePfeile, ids.length, alle]);

  const schiebe = (richtung: 1 | -1) => {
    const bahn = bahnRef.current;
    if (!bahn) return;
    const karte = bahn.querySelector<HTMLElement>("[data-karte]");
    const breite = karte ? karte.offsetWidth + 16 : 130;
    bahn.scrollBy({ left: richtung * breite * 2, behavior: "smooth" });
  };

  const sichtbar = alle ? ids : ids.slice(0, 60);

  if (ids.length === 0) {
    return <p className="mt-2 text-xs font-semibold text-ink-600">{leerText ?? "Nichts vorhanden."}</p>;
  }

  return (
    <div className="relative">
      <div
        ref={bahnRef}
        onScroll={aktualisierePfeile}
        className="no-scrollbar -mx-1 mt-4 flex gap-4 overflow-x-auto px-1 pb-2"
      >
        {sichtbar.map((id) => {
          const blatt = BLAETTER_NACH_ID.get(id);
          if (!blatt) return null;
          const extra = zusatz?.(id);
          return (
            <figure key={id} data-karte className="flex w-28 shrink-0 snap-start flex-col">
              <div className="overflow-hidden rounded-2xl bg-white ring-1 ring-candy-100">
                <img
                  src={blatt.bild}
                  alt={blattTitel(blatt)}
                  loading="lazy"
                  className="aspect-square w-full object-contain p-1"
                />
              </div>
              <figcaption
                className="mt-1 truncate text-center text-[10px] font-bold text-ink-700"
                title={blattTitel(blatt)}
              >
                {blattTitel(blatt)}
              </figcaption>
              {extra && (
                <p className="mt-0.5 line-clamp-2 text-center text-[9px] font-semibold text-candy-700" title={extra}>
                  {extra}
                </p>
              )}
              {knopfStil && aufBlatt && (
                <button
                  type="button"
                  onClick={() => aufBlatt(id)}
                  className={cn(
                    "mt-1.5 w-full rounded-full py-1 text-[10px] font-bold text-white",
                    knopfStil === "gruen" ? "bg-emerald-600 hover:bg-emerald-700" : "bg-candy-500 hover:bg-candy-600",
                  )}
                >
                  {knopfText ?? "Angebot machen"}
                </button>
              )}
            </figure>
          );
        })}
      </div>

      {kannZurueck && (
        <button
          type="button"
          aria-label="Zurück"
          onClick={() => schiebe(-1)}
          className="absolute left-2 top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white text-candy-600 shadow-lg ring-1 ring-candy-100 transition hover:bg-candy-500 hover:text-white"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
      )}
      {kannVor && (
        <button
          type="button"
          aria-label="Weiter"
          onClick={() => schiebe(1)}
          className="absolute right-2 top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white text-candy-600 shadow-lg ring-1 ring-candy-100 transition hover:bg-candy-500 hover:text-white"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      )}

      {!alle && ids.length > 60 && (
        <button
          type="button"
          onClick={() => setAlle(true)}
          className="mt-2 rounded-full bg-cream-100 px-4 py-1.5 text-xs font-bold text-ink-700 hover:bg-cream-200"
        >
          Alle {ids.length} anzeigen
        </button>
      )}
      {alle && ids.length > 60 && (
        <p className="mt-2 text-[11px] font-semibold text-ink-600">
          Zeige alle {ids.length} – mit den Pfeiltasten seitlich blättern.
        </p>
      )}
    </div>
  );
}

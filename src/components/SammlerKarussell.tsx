"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Images, Star } from "lucide-react";
import type { Benutzer } from "@/lib/types";
import { BLAETTER_NACH_ID, nameOderNummer } from "@/lib/blaetter";
import { ladeBeweisFotos } from "@/lib/beweise";
import { cn } from "@/lib/utils";

type BildQuelle = "vorlage" | "beweis" | "favoriten";

export function SammlerKarussell({ benutzer, titel }: { benutzer: Benutzer; titel?: string }) {
  const [quelle, setQuelle] = useState<BildQuelle>("vorlage");
  const bahnRef = useRef<HTMLDivElement>(null);
  const [kannVor, setKannVor] = useState(false);
  const [kannZurueck, setKannZurueck] = useState(false);
  const [fotos, setFotos] = useState<Record<string, string>>({});

  useEffect(() => {
    let aktiv = true;
    ladeBeweisFotos(benutzer.id).then((f) => {
      if (aktiv) setFotos(f);
    });
    return () => {
      aktiv = false;
    };
  }, [benutzer.id]);

  const eigeneIds = Object.keys(benutzer.statuses)
    .filter((id) => benutzer.statuses[id]?.includes("own"))
    .sort((a, b) => a.localeCompare(b));
  const hatBeweise = Object.keys(benutzer.beweise ?? {}).length > 0;
  const hatFavoriten = Object.keys(benutzer.favoriten ?? {}).length > 0;
  const ids =
    quelle === "beweis"
      ? eigeneIds.filter((id) => benutzer.beweise[id])
      : quelle === "favoriten"
        ? eigeneIds.filter((id) => benutzer.favoriten?.[id])
        : eigeneIds;

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
  }, [aktualisierePfeile, ids.length]);

  const schiebe = (richtung: 1 | -1) => {
    const bahn = bahnRef.current;
    if (!bahn) return;
    const karte = bahn.querySelector<HTMLElement>("[data-karte]");
    const breite = karte ? karte.offsetWidth + 16 : 160;
    bahn.scrollBy({ left: richtung * breite, behavior: "smooth" });
  };

  return (
    <div className="card-soft p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="font-display flex items-center gap-2 text-lg font-bold text-ink-800">
          <Images className="h-5 w-5 text-candy-500" />
          {titel ?? "Lieblingsblätter"}
          <span className="chip bg-candy-100 px-1.5 py-0.5 text-xs text-candy-700">{ids.length}</span>
        </h3>
        <div className="flex overflow-hidden rounded-full ring-1 ring-cream-300">
          <button
            type="button"
            onClick={() => setQuelle("vorlage")}
            aria-pressed={quelle === "vorlage"}
            className={cn(
              "px-3 py-1.5 text-sm font-bold transition-colors",
              quelle === "vorlage" ? "bg-candy-500 text-white shadow-sm" : "bg-white text-ink-600 hover:bg-candy-100",
            )}
          >
            Vorlagen
          </button>
          <button
            type="button"
            onClick={() => setQuelle("beweis")}
            disabled={!hatBeweise}
            title={hatBeweise ? undefined : "Erst Foto-Beweise hochladen"}
            aria-pressed={quelle === "beweis"}
            className={cn(
              "px-3 py-1.5 text-sm font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-50",
              quelle === "beweis" ? "bg-candy-500 text-white shadow-sm" : "bg-white text-ink-600 hover:bg-candy-100",
            )}
          >
            Beweisfotos
          </button>
          <button
            type="button"
            onClick={() => setQuelle("favoriten")}
            disabled={!hatFavoriten}
            title={hatFavoriten ? undefined : "Noch keine Top-Favoriten markiert"}
            aria-pressed={quelle === "favoriten"}
            className={cn(
              "flex items-center gap-1 px-3 py-1.5 text-sm font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-50",
              quelle === "favoriten" ? "bg-candy-500 text-white shadow-sm" : "bg-white text-ink-600 hover:bg-candy-100",
            )}
          >
            <Star className="h-3.5 w-3.5" /> Favoriten
          </button>
        </div>
      </div>

      {ids.length === 0 ? (
        <p className="mt-4 text-sm font-semibold text-ink-600">
          {eigeneIds.length === 0
            ? "Noch keine Lieblingsblätter markiert – im Katalog Häkchen setzen!"
            : quelle === "beweis"
              ? "Für diese Ansicht gibt es noch keine Beweisfotos."
              : "Noch keine Top-Favoriten mit dem Stern markiert."}
        </p>
      ) : (
        <div className="relative mt-4">
          <div
            ref={bahnRef}
            onScroll={aktualisierePfeile}
            className="no-scrollbar -mx-1 flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-smooth px-1 pb-2"
          >
            {ids.map((id) => {
              const blatt = BLAETTER_NACH_ID.get(id);
              if (!blatt) return null;
              const roh = benutzer.beweise[id];
              const beweisBild = typeof roh === "string" ? roh : fotos[id];
              return (
                <figure key={id} data-karte className="w-32 shrink-0 snap-start sm:w-40">
                  <div className="overflow-hidden rounded-2xl bg-white ring-1 ring-candy-100">
                    <img
                      src={quelle === "beweis" && beweisBild ? beweisBild : blatt.bild}
                      alt={nameOderNummer(blatt)}
                      loading="lazy"
                      className="aspect-square w-full object-contain p-1"
                    />
                  </div>
                  <figcaption
                    className="mt-1 truncate text-center text-[10px] font-bold text-ink-700"
                    title={nameOderNummer(blatt)}
                  >
                    {nameOderNummer(blatt)}
                  </figcaption>
                </figure>
              );
            })}
          </div>

          {kannZurueck && (
            <button
              type="button"
              aria-label="Zurück"
              onClick={() => schiebe(-1)}
              className="absolute top-1/2 -left-3 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white text-candy-600 shadow-lg ring-1 ring-candy-100 transition hover:bg-candy-500 hover:text-white"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
          )}
          {kannVor && (
            <button
              type="button"
              aria-label="Weiter"
              onClick={() => schiebe(1)}
              className="absolute top-1/2 -right-3 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white text-candy-600 shadow-lg ring-1 ring-candy-100 transition hover:bg-candy-500 hover:text-white"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          )}
        </div>
      )}
    </div>
  );
}

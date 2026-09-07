"use client";

import { useMemo } from "react";
import Link from "next/link";
import { Printer, Repeat2, Search } from "lucide-react";
import { useStoreVersion } from "@/lib/useStoreVersion";
import { getSession } from "@/lib/store";
import { BLAETTER, blattTitel } from "@/lib/blaetter";
import type { Blatt } from "@/lib/types";

type Zeile = {
  blatt: Blatt;
  betrag: number | null;
  notiz: string | null;
  anzahl: number;
};

function groesseIndex(g: string) {
  if (g === "Din A4") return 0;
  if (g === "Din A5") return 1;
  if (g === "Din A6") return 2;
  return 3;
}

function formatBetrag(wert: number | null) {
  return wert === null ? null : wert.toLocaleString("de-DE", { style: "currency", currency: "EUR" });
}

export default function TauschlisteSeite() {
  useStoreVersion();
  const benutzer = getSession();

  const zeilen = useMemo<Zeile[]>(() => {
    if (!benutzer) return [];
    const eintraege: Zeile[] = [];
    for (const b of BLAETTER) {
      if (!benutzer.statuses[b.id]?.includes("offer")) continue;
      const info = benutzer.tausch?.[b.id];
      eintraege.push({
        blatt: b,
        betrag: info?.betrag ?? null,
        notiz: info?.notiz ?? null,
        anzahl: benutzer.anzahl?.[b.id] ?? 1,
      });
    }
    return eintraege.sort(
      (a, b) =>
        groesseIndex(a.blatt.groesse) - groesseIndex(b.blatt.groesse) ||
        (a.blatt.jahr ?? 0) - (b.blatt.jahr ?? 0) ||
        a.blatt.nummer - b.blatt.nummer ||
        a.blatt.id.localeCompare(b.blatt.id),
    );
  }, [benutzer]);

  const gruppen = useMemo(() => {
    const map = new Map<string, Zeile[]>();
    for (const z of zeilen) {
      const key = z.blatt.kategorie === "relief" ? "Reliefblätter" : z.blatt.groesse;
      const liste = map.get(key) ?? [];
      liste.push(z);
      map.set(key, liste);
    }
    return [...map.entries()];
  }, [zeilen]);

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight text-ink-800">
            Tausch<span className="text-candy-500">liste</span>
          </h1>
          {benutzer && (
            <p className="text-sm font-semibold text-ink-600">
              {benutzer.name} · {zeilen.length} {zeilen.length === 1 ? "Blatt" : "Blätter"} zum Tauschen · Stand{" "}
              {new Date().toLocaleDateString("de-DE")}
            </p>
          )}
        </div>
        <div className="flex gap-2 print:hidden">
          <button
            type="button"
            onClick={() => window.print()}
            className="flex items-center gap-1.5 rounded-full bg-candy-500 px-4 py-2 text-sm font-bold text-white transition hover:bg-candy-600"
          >
            <Printer className="h-4 w-4" />
            Drucken / Als PDF speichern
          </button>
        </div>
      </div>

      {!benutzer && (
        <div className="card-soft mt-6 flex flex-col gap-2 p-6 text-center text-sm text-ink-600">
          <Search className="mx-auto h-8 w-8 text-candy-300" />
          <p className="font-display text-lg font-bold text-ink-800">Noch nicht angemeldet</p>
          <p>
            <Link href="/konto" className="font-bold text-candy-600 hover:underline">
              Melde dich an
            </Link>{" "}
            , damit deine Tauschliste alle deine Zum-Tauschen-Blätter zeigt.
          </p>
        </div>
      )}

      {benutzer && zeilen.length === 0 && (
        <div className="card-soft mt-6 flex flex-col items-center gap-2 p-10 text-center text-ink-600">
          <Repeat2 className="h-8 w-8 text-candy-300" />
          <p className="font-display text-lg font-bold">Noch keine Tausch-Blätter</p>
          <p className="text-sm">
            Markiere Blätter in{" "}
            <Link href="/konto" className="font-bold text-candy-600 hover:underline">
              deiner Sammlung
            </Link>{" "}
            als „Zum Tauschen“ – dann erscheinen sie hier mit Bild und Konditionen.
          </p>
        </div>
      )}

      {gruppen.map(([titel, liste]) => (
        <section key={titel} className="mt-6 print:mt-4 print:break-inside-avoid">
          <h2 className="font-display text-xl font-bold text-ink-800">{titel}</h2>
          <p className="text-xs font-semibold text-ink-600">{liste.length} Blätter</p>
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 print:grid-cols-3 print:gap-2">
            {liste.map((z) => {
              const betrag = formatBetrag(z.betrag);
              return (
                <figure key={z.blatt.id} className="card-soft overflow-hidden p-3 print:break-inside-avoid print:p-2 print:shadow-none">
                  <img
                    src={z.blatt.bild}
                    alt={blattTitel(z.blatt)}
                    className="aspect-square w-full rounded-xl bg-white object-contain ring-1 ring-cream-200"
                  />
                  <figcaption className="mt-2">
                    <p className="line-clamp-1 text-sm font-bold text-ink-800" title={blattTitel(z.blatt)}>
                      {blattTitel(z.blatt)}
                    </p>
                    <p className="text-xs font-semibold text-ink-600">
                      {z.blatt.groesse} · Nr. {z.blatt.nummer}
                      {z.blatt.jahr !== null ? <> · {z.blatt.jahr}</> : null} · {z.blatt.farbe}
                    </p>
                    {(betrag || z.notiz || z.anzahl > 1) && (
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        {betrag && (
                          <span className="rounded-full bg-mint-100 px-2.5 py-0.5 text-xs font-bold text-emerald-800">
                            {betrag}
                          </span>
                        )}
                        {z.anzahl > 1 && (
                          <span className="rounded-full bg-cream-100 px-2.5 py-0.5 text-xs font-bold text-ink-700">
                            ×{z.anzahl} Stück
                          </span>
                        )}
                      </div>
                    )}
                    {z.notiz && <p className="mt-1 text-xs font-semibold text-ink-600">„{z.notiz}“</p>}
                  </figcaption>
                </figure>
              );
            })}
          </div>
        </section>
      ))}

      {benutzer && zeilen.length > 0 && (
        <div className="card-soft mt-8 border-emerald-300 bg-emerald-50 p-4 text-center print:break-inside-avoid">
          <p className="font-display text-base font-bold text-emerald-800">
            Diddl-Collect – das kostenlose Sammelalbum für Diddl-Blätter
          </p>
          <p className="mt-1 text-xs font-semibold text-emerald-700">
            Katalog, Wunschliste, Tauschbörse, Rangliste &amp; Verzeichnis – alles kostenlos unter{" "}
            <a
              href="https://diddl-collect.de"
              target="_blank"
              rel="noopener noreferrer"
              className="font-bold underline underline-offset-2 hover:text-emerald-900"
            >
              diddl-collect.de
            </a>
            . Sammle mit, hänge deine Funde an und tausche Doppelte mit der Stube!
          </p>
        </div>
      )}
    </main>
  );
}

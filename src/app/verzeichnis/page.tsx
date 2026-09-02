"use client";

import { useMemo } from "react";
import Link from "next/link";
import { Download, Printer, Search } from "lucide-react";
import { useStoreVersion } from "@/lib/useStoreVersion";
import { getSession } from "@/lib/store";
import { BLAETTER, blattTitel, uebersichtSammlung } from "@/lib/blaetter";
import type { Blatt, Status } from "@/lib/types";

type Zeile = {
  blatt: Blatt;
  status: Status[];
  block: boolean;
  anzahl: number;
  favorit: boolean;
  bewiesen: boolean;
};

function groesseIndex(g: string) {
  if (g === "Din A4") return 0;
  if (g === "Din A5") return 1;
  if (g === "Din A6") return 2;
  return 3;
}

export default function VerzeichnisSeite() {
  useStoreVersion();
  const benutzer = getSession();

  const zeilen = useMemo<Zeile[]>(() => {
    if (!benutzer) return [];
    const eintraege: Zeile[] = [];
    for (const b of BLAETTER) {
      const st = benutzer.statuses[b.id] ?? [];
      const block = benutzer.blocks?.[b.id] === true;
      const anzahl = benutzer.anzahl?.[b.id];
      const favorit = benutzer.favoriten?.[b.id] === true;
      const bewiesen = !!benutzer.beweise[b.id];
      if (st.length === 0 && !block && (anzahl ?? 1) <= 1 && !favorit && !bewiesen) continue;
      eintraege.push({ blatt: b, status: st, block, anzahl: anzahl ?? 1, favorit, bewiesen });
    }
    return eintraege.sort(
      (a, b) =>
        groesseIndex(a.blatt.groesse) - groesseIndex(b.blatt.groesse) ||
        (a.blatt.jahr ?? 0) - (b.blatt.jahr ?? 0) ||
        a.blatt.nummer - b.blatt.nummer ||
        a.blatt.id.localeCompare(b.blatt.id),
    );
  }, [benutzer]);

  const ueb = useMemo(() => (benutzer ? uebersichtSammlung(benutzer) : null), [benutzer]);

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

  function csvDownload() {
    const kopf = ["Blatt", "Jahr", "Größe", "Farbe", "Hab ich", "Wunsch", "Tausch", "Block", "Stückzahl", "Top-Favorit", "Bewiesen"].join(";");
    const zeileCsv = zeilen.map((z) =>
      [
        blattTitel(z.blatt),
        z.blatt.jahr ?? "",
        z.blatt.groesse,
        z.blatt.farbe,
        z.status.includes("own") ? "ja" : "nein",
        z.status.includes("wish") ? "ja" : "nein",
        z.status.includes("offer") ? "ja" : "nein",
        z.block ? "ja" : "nein",
        z.anzahl,
        z.favorit ? "ja" : "nein",
        z.bewiesen ? "ja" : "nein",
      ]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`)
        .join(";"),
    );
    const blob = new Blob(["\uFEFF" + [kopf, ...zeileCsv].join("\r\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "diddl-collect-verzeichnis.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight text-ink-800">
            Diddl-<span className="text-candy-500">Verzeichnis</span>
          </h1>
          {benutzer && (
            <p className="text-sm font-semibold text-ink-600">
              {benutzer.name} · Stand {new Date().toLocaleDateString("de-DE")}
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
          <button
            type="button"
            onClick={csvDownload}
            className="flex items-center gap-1.5 rounded-full bg-white px-4 py-2 text-sm font-bold text-ink-700 ring-1 ring-cream-300 transition hover:bg-mint-200 hover:ring-mint-300"
          >
            <Download className="h-4 w-4" />
            CSV herunterladen
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
            , damit dein Verzeichnis alle deine Markierungen zeigt.
          </p>
        </div>
      )}

      {benutzer && ueb && (
        <div className="card-soft mt-6 grid grid-cols-2 gap-2 p-4 print:grid-cols-4 sm:grid-cols-4">
          <div className="rounded-2xl bg-cream-50 px-3 py-2 text-center ring-1 ring-cream-200">
            <p className="font-display text-xl font-bold text-emerald-600">{ueb.bloecke}</p>
            <p className="text-[10px] font-bold uppercase tracking-wide text-ink-600">Blöcke</p>
          </div>
          <div className="rounded-2xl bg-cream-50 px-3 py-2 text-center ring-1 ring-cream-200">
            <p className="font-display text-xl font-bold text-candy-500">{ueb.blaetter}</p>
            <p className="text-[10px] font-bold uppercase tracking-wide text-ink-600">Eigene Blätter</p>
          </div>
          <div className="rounded-2xl bg-cream-50 px-3 py-2 text-center ring-1 ring-cream-200">
            <p className="font-display text-xl font-bold text-peach-500">{ueb.reliefs}</p>
            <p className="text-[10px] font-bold uppercase tracking-wide text-ink-600">Reliefblätter</p>
          </div>
          <div className="rounded-2xl bg-cream-50 px-3 py-2 text-center ring-1 ring-cream-200">
            <p className="font-display text-xl font-bold text-berry-400">{ueb.exemplare}</p>
            <p className="text-[10px] font-bold uppercase tracking-wide text-ink-600">Exemplare gesamt</p>
          </div>
        </div>
      )}

      {benutzer && zeilen.length === 0 && (
        <div className="card-soft mt-6 p-10 text-center text-sm text-ink-600">
          Noch keine Markierungen – im <Link href="/katalog" className="font-bold text-candy-600 hover:underline">Katalog</Link>{" "}
          beginnt deine Sammlung.
        </div>
      )}

      {gruppen.map(([titel, liste]) => (
        <section key={titel} className="mt-6">
          <h2 className="font-display text-xl font-bold text-ink-800">{titel}</h2>
          <p className="text-xs font-semibold text-ink-600">{liste.length} Blätter</p>
          <div className="card-soft mt-3 overflow-x-auto p-2">
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="border-b border-candy-100 text-left text-xs uppercase tracking-wide text-ink-600">
                  <th className="px-3 py-2">Blatt</th>
                  <th className="px-3 py-2 text-right">Jahr/Nummer</th>
                  <th className="px-3 py-2">Farbe</th>
                  <th className="px-3 py-2 text-center">Hab ich</th>
                  <th className="px-3 py-2 text-center">Wunsch</th>
                  <th className="px-3 py-2 text-center">Tausch</th>
                  <th className="px-3 py-2 text-center">Block</th>
                  <th className="px-3 py-2 text-center">×Stück</th>
                  <th className="px-3 py-2 text-center">Top</th>
                  <th className="px-3 py-2 text-center">Beweis</th>
                </tr>
              </thead>
              <tbody>
                {liste.map((z) => (
                  <tr key={z.blatt.id} className="border-b border-cream-100 last:border-0">
                    <td className="px-3 py-1.5 font-semibold text-ink-800">{blattTitel(z.blatt)}</td>
                    <td className="px-3 py-1.5 text-right text-ink-600">
                      {z.blatt.jahr ?? "–"} / {z.blatt.nummer}
                    </td>
                    <td className="px-3 py-1.5 text-ink-600">{z.blatt.farbe}</td>
                    <td className="px-3 py-1.5 text-center">{z.status.includes("own") ? "✓" : ""}</td>
                    <td className="px-3 py-1.5 text-center">{z.status.includes("wish") ? "✓" : ""}</td>
                    <td className="px-3 py-1.5 text-center">{z.status.includes("offer") ? "✓" : ""}</td>
                    <td className="px-3 py-1.5 text-center">{z.block ? "✓" : ""}</td>
                    <td className="px-3 py-1.5 text-center">{z.anzahl > 1 ? `×${z.anzahl}` : ""}</td>
                    <td className="px-3 py-1.5 text-center">{z.favorit ? "★" : ""}</td>
                    <td className="px-3 py-1.5 text-center">{z.bewiesen ? "✓" : ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ))}
    </main>
  );
}

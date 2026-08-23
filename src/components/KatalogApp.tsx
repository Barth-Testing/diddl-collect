"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowDownUp, Check, Heart, LogIn, Repeat2, Search, SlidersHorizontal, X } from "lucide-react";
import { BLAETTER, VERFÜGBARE_FARBEN } from "@/lib/blaetter";
import { getSession, setStatus } from "@/lib/store";
import { FARBREIHENFOLGE, type Status } from "@/lib/types";
import { BlattKarte } from "./BlattKarte";
import { Lupe } from "./Lupe";
import { SelectBasis } from "./SelectBasis";
import { useStoreVersion } from "@/lib/useStoreVersion";

type Sortierung = "jahr-auf" | "jahr-ab" | "groesse" | "farbe" | "nummer" | "name";
type StatusFilter = "Alle" | "own" | "wish" | "offer" | "none";

const GROESSEN_FILTER = ["Alle Größen", "Din A4", "Din A5", "Din A6"] as const;
const JAHRE = Array.from({ length: 11 }, (_, i) => 1996 + i);

export function KatalogApp() {
  useStoreVersion();
  const benutzer = getSession();
  const [sort, setSort] = useState<Sortierung>("jahr-auf");
  const [groesse, setGroesse] = useState<string>("Alle Größen");
  const [farbe, setFarbe] = useState<string>("Alle Farben");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("Alle");
  const [suche, setSuche] = useState("");
  const [jahrVon, setJahrVon] = useState(1996);
  const [jahrBis, setJahrBis] = useState(2006);
  const [toast, setToast] = useState<string | null>(null);
  const [lupe, setLupe] = useState<string | null>(null);

  const statuses = useMemo(() => benutzer?.statuses ?? {}, [benutzer]);
  const beweise = useMemo(() => benutzer?.beweise ?? {}, [benutzer]);

  const gefiltert = useMemo(() => {
    const q = suche.trim().toLowerCase();
    const liste = BLAETTER.filter((b) => {
      if (groesse !== "Alle Größen" && b.groesse !== groesse) return false;
      if (farbe !== "Alle Farben" && b.farbe !== farbe) return false;
      if (b.jahr < jahrVon || b.jahr > jahrBis) return false;
      if (statusFilter !== "Alle") {
        const s = statuses[b.id] ?? null;
        if (statusFilter === "none" ? s !== null : s !== statusFilter) return false;
      }
      if (q) {
        const text = `${b.name ?? ""} ${b.nummer} ${b.groesse} ${b.farbe}`.toLowerCase();
        if (!text.includes(q)) return false;
      }
      return true;
    });
    const farbIndex = (f: string) => {
      const i = FARBREIHENFOLGE.indexOf(f as (typeof FARBREIHENFOLGE)[number]);
      return i === -1 ? 99 : i;
    };
    const groesseIndex = (g: string) => (g === "Din A4" ? 0 : g === "Din A5" ? 1 : 2);
    const sortiert = [...liste];
    switch (sort) {
      case "jahr-auf":
        sortiert.sort((a, b) => a.jahr - b.jahr || a.nummer - b.nummer);
        break;
      case "jahr-ab":
        sortiert.sort((a, b) => b.jahr - a.jahr || a.nummer - b.nummer);
        break;
      case "groesse":
        sortiert.sort((a, b) => groesseIndex(a.groesse) - groesseIndex(b.groesse) || a.nummer - b.nummer);
        break;
      case "farbe":
        sortiert.sort((a, b) => farbIndex(a.farbe) - farbIndex(b.farbe) || a.nummer - b.nummer);
        break;
      case "nummer":
        sortiert.sort((a, b) => a.nummer - b.nummer);
        break;
      case "name":
        sortiert.sort((a, b) => (a.name ?? `zzz${a.nummer}`).localeCompare(b.name ?? `zzz${b.nummer}`));
        break;
    }
    return sortiert;
  }, [sort, groesse, farbe, statusFilter, suche, jahrVon, jahrBis, statuses]);

  const ownGesamt = Object.values(statuses).filter((s) => s === "own").length;

  const togglen = (blattId: string, status: Status) => {
    const angemeldet = getSession();
    if (!angemeldet) {
      setToast("Hallo! Melde dich bitte erst an, um deine Sammlung zu pflegen.");
      return;
    }
    setStatus(blattId, statuses[blattId] === status ? null : status);
  };

  const lupeBlatt = lupe ? BLAETTER.find((b) => b.id === lupe) : undefined;

  return (
    <div className="mt-6 space-y-4">
      {toast && (
        <div className="animate-pop card-soft flex items-center gap-3 border-peach-300 bg-peach-50 px-4 py-3 text-sm font-semibold text-ink-800">
          <span>{toast}</span>
          <Link href="/konto" className="rounded-full bg-candy-500 px-3 py-1 text-xs font-bold text-white hover:bg-candy-600">
            Anmelden
          </Link>
          <button onClick={() => setToast(null)} className="ml-auto text-ink-600 hover:text-candy-600" aria-label="Hinweis schließen">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      <div className="card-soft p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <label className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-600" />
            <input
              value={suche}
              onChange={(e) => setSuche(e.target.value)}
              placeholder="Nach Motiv, Nummer, Farbe suchen …"
              className="w-full rounded-full border border-cream-300 bg-white py-2.5 pl-9 pr-4 text-sm font-semibold text-ink-800 outline-none placeholder:text-ink-600/60 focus:border-candy-400 focus:ring-2 focus:ring-candy-200"
            />
          </label>

          <div className="flex flex-wrap items-center gap-2">
            <span className="chip bg-candy-100 px-2.5 py-1.5 text-candy-700">
              <ArrowDownUp className="h-3.5 w-3.5" /> Sortieren
            </span>
            <SelectBasis
              value={sort}
              onChange={(v) => setSort(v as Sortierung)}
              optionen={[
                ["jahr-auf", "Jahr (alt → neu)"],
                ["jahr-ab", "Jahr (neu → alt)"],
                ["groesse", "Größe"],
                ["farbe", "Farbe"],
                ["nummer", "Nummer"],
                ["name", "Motiv (A–Z)"],
              ]}
            />
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
          <span className="chip bg-candy-100 px-2.5 py-1.5 text-candy-700">
            <SlidersHorizontal className="h-3.5 w-3.5" /> Filtern
          </span>
          <SelectBasis
            value={groesse}
            onChange={setGroesse}
            optionen={GROESSEN_FILTER.map((g) => [g, g])}
          />
          <SelectBasis
            value={farbe}
            onChange={setFarbe}
            optionen={[["Alle Farben", "Alle Farben"], ...VERFÜGBARE_FARBEN.map((f) => [f, f])]}
          />
          <SelectBasis
            value={statusFilter}
            onChange={(v) => setStatusFilter(v as StatusFilter)}
            optionen={[
              ["Alle", "Alle Stati"],
              ["own", "Genau: Hab ich"],
              ["wish", "Genau: Wunsch"],
              ["offer", "Genau: Tausch"],
              ["none", "Noch nicht erfasst"],
            ]}
          />
          <label className="flex items-center gap-1.5 text-xs font-bold text-ink-600">
            <select
              value={jahrVon}
              onChange={(e) => setJahrVon(Number(e.target.value))}
              className="rounded-full border border-cream-300 bg-white px-2 py-1.5 text-xs font-bold text-ink-800 outline-none focus:border-candy-400"
            >
              {JAHRE.map((j) => (
                <option key={j} value={j}>{j}</option>
              ))}
            </select>
            –
            <select
              value={jahrBis}
              onChange={(e) => setJahrBis(Number(e.target.value))}
              className="rounded-full border border-cream-300 bg-white px-2 py-1.5 text-xs font-bold text-ink-800 outline-none focus:border-candy-400"
            >
              {JAHRE.map((j) => (
                <option key={j} value={j}>{j}</option>
              ))}
            </select>
          </label>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs font-bold text-ink-600">
        <span>
          Zeige <span className="text-candy-600">{gefiltert.length}</span> von {BLAETTER.length} Blättern
        </span>
        {benutzer && (
          <span>
            Deine Sammlung: <span className="text-candy-600">{ownGesamt}</span> von {BLAETTER.length} Blättern
          </span>
        )}
        <span className="flex items-center gap-1">
          <Check className="h-3.5 w-3.5 text-candy-500" /> Hab ich
        </span>
        <span className="flex items-center gap-1">
          <Heart className="h-3.5 w-3.5 text-berry-400" /> Wunsch
        </span>
        <span className="flex items-center gap-1">
          <Repeat2 className="h-3.5 w-3.5 text-peach-500" /> Zum Tauschen
        </span>
        {!benutzer && (
          <Link href="/konto" className="flex items-center gap-1 text-candy-600 hover:underline">
            <LogIn className="h-3.5 w-3.5" /> Anmelden zum Häkchen setzen
          </Link>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 md:grid-cols-4 lg:grid-cols-5">
        {gefiltert.map((b) => (
          <BlattKarte
            key={b.id}
            blatt={b}
            status={statuses[b.id] ?? null}
            bewiesen={!!beweise[b.id]}
            aufToggle={(s) => togglen(b.id, s)}
            aufBild={() => setLupe(b.id)}
          />
        ))}
      </div>

      {gefiltert.length === 0 && (
        <div className="card-soft flex flex-col items-center gap-2 p-10 text-center text-ink-600">
          <p className="font-display text-lg font-bold">Hoppla, hier ist nichts!</p>
          <p className="text-sm">Probier einen anderen Filter oder eine andere Suche.</p>
        </div>
      )}

      {lupeBlatt && (
        <Lupe
          blatt={lupeBlatt}
          status={statuses[lupeBlatt.id] ?? null}
          aufSchliessen={() => setLupe(null)}
          aufToggle={(s) => togglen(lupeBlatt.id, s)}
        />
      )}
    </div>
  );
}

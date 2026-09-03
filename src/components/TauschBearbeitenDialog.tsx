"use client";

import { useMemo, useState } from "react";
import { Check, Pencil, X } from "lucide-react";
import type { Blatt } from "@/lib/types";
import { BLAETTER_NACH_ID, blattTitel } from "@/lib/blaetter";
import { listBenutzer } from "@/lib/store";
import { useStoreVersion } from "@/lib/useStoreVersion";
import { aendereAngebot, type TauschAngebot } from "@/lib/tausch";
import { cn } from "@/lib/utils";

type Props = {
  angebot: TauschAngebot;
  ich: { id: string; name: string };
  aufSchliessen: () => void;
};

function blattListe(ids: string[]) {
  return ids
    .map((id) => BLAETTER_NACH_ID.get(id))
    .filter((b): b is Blatt => !!b)
    .sort((a, b) => blattTitel(a).localeCompare(blattTitel(b), "de", { numeric: true }));
}

export function TauschBearbeitenDialog({ angebot, ich, aufSchliessen }: Props) {
  useStoreVersion();
  const [wunsch, setWunsch] = useState<string[]>(angebot.wunschBlatter);
  const [gebe, setGebe] = useState<string[]>(angebot.angebotBlaetter);
  const [betrag, setBetrag] = useState(
    angebot.angebotBetrag === null ? "" : String(angebot.angebotBetrag).replace(".", ","),
  );
  const [nachricht, setNachricht] = useState(angebot.nachricht ?? "");
  const [gesendet, setGesendet] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);

  const alsAnbieter = angebot.anbieterId === ich.id;
  const anbieter = alsAnbieter ? ich : { id: angebot.anbieterId, name: angebot.anbieterName };
  const interessent = alsAnbieter
    ? { id: angebot.interessentId, name: angebot.interessentName }
    : ich;

  /* Wunsch-Pool: die Tauschblätter des Anbieters. */
  const wunschPool = useMemo(() => {
    const daten = listBenutzer().find((u) => u.id === anbieter.id);
    if (!daten) return blattListe(angebot.wunschBlatter);
    return blattListe(
      Object.keys(daten.statuses).filter((id) => daten.statuses[id]?.includes("offer")),
    );
  }, [anbieter.id, angebot.wunschBlatter]);

  /* Gebe-Pool: die Tauschblätter des Interessenten. */
  const gebePool = useMemo(() => {
    const daten = listBenutzer().find((u) => u.id === interessent.id);
    if (!daten) return blattListe(angebot.angebotBlaetter);
    return blattListe(
      Object.keys(daten.statuses).filter((id) => daten.statuses[id]?.includes("offer")),
    );
  }, [interessent.id, angebot.angebotBlaetter]);

  const betragZahl = betrag.trim() === "" ? null : Number(betrag.replace(",", "."));
  const istSichtbar = (pool: Blatt[], ids: string[]) => ids.length === pool.length;
  const kannSenden =
    (wunsch.length > 0 || gebe.length > 0 || (betragZahl !== null && !Number.isNaN(betragZahl))) &&
    nachricht.length <= 500;

  function baueDiff(): string {
    const teile: string[] = [];
    const aendern = (vorher: string[], neu: string[], textVorher: string, textNeu: string) => {
      const hinzu = neu.filter((id) => !vorher.includes(id));
      const raus = vorher.filter((id) => !neu.includes(id));
      if (hinzu.length > 0) teile.push(`${textNeu}: + ${hinzu.map((id) => { const b = BLAETTER_NACH_ID.get(id); return b ? `„${blattTitel(b)}“` : id; }).join(", ")}`);
      if (raus.length > 0) teile.push(`${textVorher}: − ${raus.map((id) => { const b = BLAETTER_NACH_ID.get(id); return b ? `„${blattTitel(b)}“` : id; }).join(", ")}`);
    };
    aendern(angebot.wunschBlatter, wunsch, "Wunschblätter", "Wunschblätter");
    aendern(angebot.angebotBlaetter, gebe, "Gebotene Blätter", "Gebotene Blätter");
    const altBetrag = angebot.angebotBetrag;
    if (altBetrag !== betragZahl) {
      teile.push(
        betragZahl === null
          ? `Betrag: € ${altBetrag?.toLocaleString("de-DE", { minimumFractionDigits: 2 })} gestrichen`
          : `Betrag: ${betragZahl.toLocaleString("de-DE", { style: "currency", currency: "EUR" })}${altBetrag === null ? "" : ` (vorher: ${altBetrag.toLocaleString("de-DE", { style: "currency", currency: "EUR" })})`}`,
      );
    }
    if (teile.length === 0) return `${ich.name} hat das Angebot überarbeitet.`;
    return `${ich.name} hat geändert: ${teile.join(" · ")}`;
  }

  async function absenden() {
    if (!kannSenden || gesendet) return;
    if (betragZahl !== null && (Number.isNaN(betragZahl) || betragZahl <= 0)) {
      setFehler("Bitte einen gültigen Euro-Betrag eingeben.");
      return;
    }
    setFehler(null);
    setGesendet(true);
    const ergebnis = await aendereAngebot(angebot.id, {
      wunschBlatter: wunsch.length > 0 ? wunsch : [angebot.blattId],
      gebeBlatter: gebe,
      betrag: betragZahl,
      nachricht: nachricht.trim() === "" ? null : nachricht.trim(),
      diff: baueDiff(),
    });
    if (!ergebnis.ok) {
      setGesendet(false);
      setFehler(ergebnis.fehler ?? "Das hat nicht geklappt.");
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/60 p-4 backdrop-blur-sm"
      onClick={aufSchliessen}
      role="dialog"
      aria-modal="true"
      aria-label="Tausch bearbeiten"
    >
      <div
        className="animate-pop card-soft flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-candy-100 px-4 py-3">
          <div className="min-w-0">
            <p className="truncate font-display text-lg font-bold text-ink-800">
              Angebot bearbeiten
            </p>
            <p className="text-xs font-semibold text-ink-600">
              Runde {angebot.runde} · du verhandelst mit{" "}
              <span className="font-bold text-candy-600">
                {alsAnbieter ? angebot.interessentName : angebot.anbieterName}
              </span>
            </p>
          </div>
          <button
            onClick={aufSchliessen}
            className="ml-2 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-cream-100 text-ink-700 hover:bg-candy-100"
            aria-label="Schließen"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {gesendet ? (
          <div className="flex flex-col items-center gap-3 p-8 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-mint-200 text-emerald-700">
              <Check className="h-6 w-6" />
            </span>
            <p className="font-display text-lg font-bold text-ink-800">Vorschlag aktualisiert!</p>
            <button
              onClick={aufSchliessen}
              className="rounded-full bg-candy-500 px-5 py-2 text-sm font-bold text-white hover:bg-candy-600"
            >
              Schließen
            </button>
          </div>
        ) : (
          <>
            <div className="space-y-4 overflow-y-auto p-4">
              <div>
                <p className="mb-1.5 text-xs font-bold uppercase tracking-wide text-ink-600">
                  Angefragte Blätter ({anbieter.name} hat {wunschPool.length} zum Tauschen)
                </p>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {wunschPool.map((b) => {
                    const aktiv = wunsch.includes(b.id);
                    return (
                      <button
                        key={b.id}
                        type="button"
                        onClick={() =>
                          setWunsch((vorher) =>
                            aktiv ? vorher.filter((id) => id !== b.id) : [...vorher, b.id].slice(0, 20),
                          )
                        }
                        aria-pressed={aktiv}
                        className={cn(
                          "flex items-center gap-2 rounded-2xl p-2 text-left transition-all",
                          aktiv
                            ? "bg-candy-500 text-white shadow-sm"
                            : "bg-white text-ink-700 ring-1 ring-cream-300 hover:ring-candy-300",
                        )}
                      >
                        <img
                          src={b.bild}
                          alt=""
                          className={cn("h-10 w-10 shrink-0 rounded-xl bg-white object-contain", aktiv && "bg-white/20")}
                        />
                        <span className="line-clamp-2 flex-1 text-xs font-bold leading-4">{blattTitel(b)}</span>
                      </button>
                    );
                  })}
                  {wunschPool.length === 0 && (
                    <p className="col-span-full text-xs font-semibold text-ink-600">
                      Keine Tauschblätter dieses Sammlers gefunden.
                    </p>
                  )}
                </div>
              </div>

              <div>
                <p className="mb-1.5 text-xs font-bold uppercase tracking-wide text-ink-600">
                  Gebotene Blätter ({interessent.name} hat {gebePool.length} zum Tauschen)
                  {istSichtbar(gebePool, gebe) ? (
                    <span className="ml-1 font-semibold text-ink-500">· alle angeboten</span>
                  ) : (
                    <span className="ml-1 font-semibold text-ink-500">· Auswahl angepasst</span>
                  )}
                </p>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {gebePool.map((b) => {
                    const aktiv = gebe.includes(b.id);
                    return (
                      <button
                        key={b.id}
                        type="button"
                        onClick={() =>
                          setGebe((vorher) =>
                            aktiv ? vorher.filter((id) => id !== b.id) : [...vorher, b.id].slice(0, 20),
                          )
                        }
                        aria-pressed={aktiv}
                        className={cn(
                          "flex items-center gap-2 rounded-2xl p-2 text-left transition-all",
                          aktiv
                            ? "bg-berry-500 text-white shadow-sm"
                            : "bg-white text-ink-700 ring-1 ring-cream-300 hover:ring-berry-300",
                        )}
                      >
                        <img
                          src={b.bild}
                          alt=""
                          className={cn("h-10 w-10 shrink-0 rounded-xl bg-white object-contain", aktiv && "bg-white/20")}
                        />
                        <span className="line-clamp-2 flex-1 text-xs font-bold leading-4">{blattTitel(b)}</span>
                      </button>
                    );
                  })}
                  {gebePool.length === 0 && (
                    <p className="col-span-full text-xs font-semibold text-ink-600">
                      Keine Tauschblätter dieses Sammlers gefunden.
                    </p>
                  )}
                </div>
              </div>

              <div>
                <p className="mb-1 text-xs font-bold uppercase tracking-wide text-ink-600">
                  Geldbetrag (€) – auch statt Blättern möglich
                </p>
                <input
                  value={betrag}
                  onChange={(e) => setBetrag(e.target.value)}
                  type="number"
                  min="0"
                  step="0.5"
                  placeholder="z. B. 7,50"
                  className="w-full rounded-full border border-cream-300 bg-white px-3 py-2 text-sm font-semibold outline-none focus:border-candy-400 focus:ring-2 focus:ring-candy-200"
                />
              </div>

              <div>
                <p className="mb-1 text-xs font-bold uppercase tracking-wide text-ink-600">
                  Nachricht (optional)
                </p>
                <textarea
                  value={nachricht}
                  onChange={(e) => setNachricht(e.target.value.slice(0, 500))}
                  rows={3}
                  placeholder="Was ist dein Vorschlag? Zustand, Versand, Porto …"
                  className="w-full rounded-2xl border border-cream-300 bg-white px-3 py-2 text-sm font-semibold outline-none focus:border-candy-400 focus:ring-2 focus:ring-candy-200"
                />
              </div>

              {fehler && (
                <p className="rounded-2xl bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">
                  {fehler}
                </p>
              )}
            </div>

            <div className="flex items-center justify-between gap-2 border-t border-candy-100 px-4 py-3">
              <p className="text-xs font-semibold text-ink-600">
                {kannSenden ? "Dein Gegenvorschlag geht per Turn zurück." : "Wähle Blätter oder einen Betrag."}
              </p>
              <button
                type="button"
                onClick={() => void absenden()}
                disabled={!kannSenden}
                className="flex items-center gap-1.5 rounded-full bg-candy-500 px-5 py-2 text-sm font-bold text-white shadow-sm hover:bg-candy-600 disabled:opacity-40"
              >
                <Pencil className="h-4 w-4" /> Vorschlag senden
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

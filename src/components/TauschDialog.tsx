"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Repeat2, Search, Send, X } from "lucide-react";
import { Gift, Sparkles } from "lucide-react";
import type { Blatt } from "@/lib/types";
import { BLAETTER_NACH_ID, blattTitel } from "@/lib/blaetter";
import { getSession, listBenutzer } from "@/lib/store";
import { useStoreVersion } from "@/lib/useStoreVersion";
import { erstelleAngebot } from "@/lib/tausch";
import { cn } from "@/lib/utils";

type Props = {
  blattId: string;
  anbieter: { id: string; name: string };
  aufSchliessen: () => void;
};

export function TauschDialog({ blattId, anbieter, aufSchliessen }: Props) {
  useStoreVersion();
  const benutzer = getSession();
  const blatt = BLAETTER_NACH_ID.get(blattId);
  const [auswahl, setAuswahl] = useState<string[]>([]);
  const [suche, setSuche] = useState("");
  const [betrag, setBetrag] = useState("");
  const [nachricht, setNachricht] = useState("");
  const [gesendet, setGesendet] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);

  const eigene = useMemo(() => {
    if (!benutzer) return [];
    return Object.keys(benutzer.statuses)
      .filter((id) => benutzer.statuses[id]?.includes("own"))
      .map((id) => BLAETTER_NACH_ID.get(id))
      .filter((b): b is NonNullable<typeof b> => b !== undefined);
  }, [benutzer]);

  /* Treffer: welche meiner Tauschblätter wünscht der Anbieter? Und umgekehrt –
     was bietet ER, das auf MEINER Wunschliste steht? (Paket-Tausch, Porto sparen) */
  const anbieterDaten = useMemo(
    () => listBenutzer().find((u) => u.id === anbieter.id) ?? null,
    [anbieter.id],
  );
  const treffer = useMemo(() => {
    if (!benutzer || !anbieterDaten) return { meine: [] as Blatt[], seine: [] as Blatt[] };
    const seineWunsch = new Set(
      Object.keys(anbieterDaten.statuses).filter((id) => anbieterDaten.statuses[id]?.includes("wish")),
    );
    const meineWunsch = new Set(
      Object.keys(benutzer.statuses).filter((id) => benutzer.statuses[id]?.includes("wish")),
    );
    const meine = eigene
      .filter((b) => seineWunsch.has(b.id))
      .sort((a, b) => blattTitel(a).localeCompare(blattTitel(b), "de", { numeric: true }));
    const seine = Object.keys(anbieterDaten.statuses)
      .filter((id) => anbieterDaten.statuses[id]?.includes("offer") && meineWunsch.has(id))
      .map((id) => BLAETTER_NACH_ID.get(id))
      .filter((b): b is Blatt => !!b)
      .sort((a, b) => blattTitel(a).localeCompare(blattTitel(b), "de", { numeric: true }));
    return { meine, seine };
  }, [benutzer, anbieterDaten, eigene]);

  function paketVorschlag() {
    const teile = [
      treffer.meine.length > 0
        ? `Ich biete dir dafür: ${treffer.meine.map((b) => `„${blattTitel(b)}“`).join(", ")}.`
        : "",
      treffer.seine.length > 0
        ? `Von dir interessieren mich zusätzlich: ${treffer.seine
            .map((b) => `„${blattTitel(b)}“`)
            .join(", ")}.`
        : "",
    ].filter(Boolean);
    if (teile.length === 0) return;
    setNachricht(`Hallo! ${teile.join(" ")} Das alles in einem Brief – spart Porto!`);
  }

  const gefiltert = useMemo(() => {
    const q = suche.trim().toLowerCase();
    if (!q) return eigene;
    return eigene.filter((b) =>
      `${blattTitel(b)} ${b.name ?? ""} ${b.nummer} ${b.groesse}`.toLowerCase().includes(q),
    );
  }, [eigene, suche]);

  if (!blatt || !benutzer) return null;

  const istMein = benutzer.id === anbieter.id;
  const betragZahl = betrag.trim() === "" ? null : Number(betrag.replace(",", "."));
  const kannSenden =
    !istMein &&
    (auswahl.length > 0 || (betragZahl !== null && !Number.isNaN(betragZahl))) &&
    nachricht.length <= 500;

  async function absenden() {
    if (!kannSenden || !benutzer || gesendet) return;
    if (betragZahl !== null && (Number.isNaN(betragZahl) || betragZahl <= 0)) {
      setFehler("Bitte einen gültigen Euro-Betrag eingeben.");
      return;
    }
    setFehler(null);
    setGesendet(true);
    await erstelleAngebot({
      blattId,
      anbieter,
      ich: benutzer,
      eigeneBlatter: auswahl,
      betrag: betragZahl,
      nachricht: nachricht.trim() === "" ? null : nachricht.trim(),
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/60 p-4 backdrop-blur-sm"
      onClick={aufSchliessen}
      role="dialog"
      aria-modal="true"
      aria-label={`Tauschangebot für ${blattTitel(blatt)}`}
    >
      <div
        className="animate-pop card-soft flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-candy-100 px-4 py-3">
          <div className="min-w-0">
            <p className="truncate font-display text-lg font-bold text-ink-800">
              Tausch-Angebot: {blattTitel(blatt)}
            </p>
            <p className="text-xs font-semibold text-ink-600">
              Blatt von <span className="font-bold text-candy-600">{anbieter.name}</span>
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
              <Send className="h-6 w-6" />
            </span>
            <p className="font-display text-lg font-bold text-ink-800">
              Dein Angebot ist raus!
            </p>
            <p className="text-sm text-ink-600">
              Der Vorschlag liegt bei {anbieter.name}. Du findest ihn unten im Postfach – dort
              kannst du auch chatten und Details klären.
            </p>
            <div className="flex gap-2">
              <Link
                href="/postfach"
                className="rounded-full bg-candy-500 px-4 py-2 text-sm font-bold text-white hover:bg-candy-600"
              >
                Zum Postfach
              </Link>
              <button
                onClick={aufSchliessen}
                className="rounded-full bg-white px-4 py-2 text-sm font-bold text-ink-600 ring-1 ring-cream-300 hover:bg-cream-100"
              >
                Schließen
              </button>
            </div>
          </div>
        ) : istMein ? (
          <div className="flex flex-col items-center gap-3 p-8 text-center">
            <Repeat2 className="h-8 w-8 text-candy-300" />
            <p className="font-display text-lg font-bold text-ink-800">Das ist dein Blatt!</p>
            <p className="text-sm text-ink-600">
              Für andere kannst du hier Angebote machen – dein Anbieter-Ansicht führst du über das
              Postfach.
            </p>
          </div>
        ) : (
          <>
            <div className="space-y-4 overflow-y-auto p-4">
              {(treffer.meine.length > 0 || treffer.seine.length > 0 || anbieterDaten) && (
                <div className="rounded-2xl bg-mint-50 p-3 ring-1 ring-mint-200">
                  <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-emerald-700">
                    <Sparkles className="h-3.5 w-3.5" /> Passende Wünsche
                  </p>
                  {treffer.meine.length > 0 ? (
                    <p className="mt-1.5 text-xs font-semibold text-ink-700">
                      Diese Blätter von dir wünscht sich {anbieter.name}:{" "}
                      {treffer.meine.map((b) => `„${blattTitel(b)}“`).join(", ")}
                    </p>
                  ) : (
                    <p className="mt-1.5 text-xs font-semibold text-ink-600">
                      Keines deiner Tauschblätter steht bei {anbieter.name} auf der Wunschliste –
                      vielleicht überzeugt ein Geldbetrag.
                    </p>
                  )}
                  {treffer.seine.length > 0 ? (
                    <>
                      <p className="mt-1.5 text-xs font-semibold text-ink-700">
                        Und du wünschst dir von ihm:{" "}
                        {treffer.seine.map((b) => `„${blattTitel(b)}“`).join(", ")}
                      </p>
                      <button
                        type="button"
                        onClick={paketVorschlag}
                        className="mt-2 flex items-center gap-1.5 rounded-full bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-700"
                      >
                        <Gift className="h-3.5 w-3.5" /> Paket-Vorschlag in die Nachricht
                      </button>
                    </>
                  ) : null}
                </div>
              )}
              <div>
                <p className="mb-1 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-ink-600">
                  <Search className="h-3.5 w-3.5" /> Eigene Blätter bieten (mehrere möglich)
                </p>
                <input
                  value={suche}
                  onChange={(e) => setSuche(e.target.value)}
                  placeholder={`Suche in deinen ${eigene.length} eigenen Blättern …`}
                  className="w-full rounded-full border border-cream-300 bg-white px-3 py-2 text-sm font-semibold outline-none focus:border-candy-400 focus:ring-2 focus:ring-candy-200"
                />
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {gefiltert.map((b) => {
                    const aktiv = auswahl.includes(b.id);
                    return (
                      <button
                        key={b.id}
                        type="button"
                        onClick={() =>
                          setAuswahl((vorher) =>
                            aktiv
                              ? vorher.filter((id) => id !== b.id)
                              : [...vorher, b.id].slice(0, 20),
                          )
                        }
                        aria-pressed={aktiv}
                        className={cn(
                          "flex items-center gap-1.5 rounded-full py-1 pl-1 pr-2.5 text-xs font-bold transition-all",
                          aktiv
                            ? "bg-candy-500 text-white shadow-sm"
                            : "bg-white text-ink-700 ring-1 ring-cream-300 hover:ring-candy-300",
                        )}
                      >
                        <img
                          src={b.bild}
                          alt=""
                          className={cn("h-6 w-6 rounded-full object-contain", aktiv ? "bg-white/20" : "bg-white")}
                        />
                        <span className="max-w-24 truncate">{blattTitel(b)}</span>
                        {anbieterDaten?.statuses[b.id]?.includes("wish") && (
                          <span title="Steht bei diesem Sammler auf der Wunschliste" aria-hidden="true">
                            ✨
                          </span>
                        )}
                      </button>
                    );
                  })}
                  {gefiltert.length === 0 && (
                    <p className="text-xs font-semibold text-ink-600">
                      Keine passenden Blätter gefunden.
                    </p>
                  )}
                </div>
                {auswahl.length > 0 && (
                  <p className="mt-1 text-xs font-semibold text-candy-700">
                    {auswahl.length} {auswahl.length === 1 ? "Blatt" : "Blätter"} ausgewählt
                  </p>
                )}
              </div>

              <div>
                <p className="mb-1 text-xs font-bold uppercase tracking-wide text-ink-600">
                  Oder Geldbetrag (€)
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
                  placeholder="Was gehört noch dazu? Handschrift, Zustand, Versand …"
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
                {auswahl.length === 0
                  ? "Wähle Blätter oder einen Betrag."
                  : `${auswahl.length} Blatt${auswahl.length === 1 ? "" : "er"}${betragZahl ? " + " + betragZahl.toLocaleString("de-DE", { style: "currency", currency: "EUR" }) : ""}`}
              </p>
              <button
                type="button"
                onClick={() => void absenden()}
                disabled={!kannSenden}
                className="rounded-full bg-candy-500 px-5 py-2 text-sm font-bold text-white shadow-sm hover:bg-candy-600 disabled:opacity-40"
              >
                <Send className="mr-1 inline h-4 w-4" /> Angebot senden
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

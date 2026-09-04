"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, Check, Heart, Repeat2, Search, Send, X } from "lucide-react";
import { Gift, Sparkles, Star } from "lucide-react";
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
  const [stufe, setStufe] = useState(1);
  const [wunschAuswahl, setWunschAuswahl] = useState<string[]>([blattId]);
  const [auswahl, setAuswahl] = useState<string[]>([]);
  const [suche, setSuche] = useState("");
  const [betrag, setBetrag] = useState("");
  const [nachricht, setNachricht] = useState("");
  const [gesendet, setGesendet] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);

  const anbieterDaten = useMemo(
    () => listBenutzer().find((u) => u.id === anbieter.id) ?? null,
    [anbieter.id],
  );

  /* Stufe 1: alles, was der Anbieter zum Tauschen markiert hat. */
  const anbieterBlaetter = useMemo(() => {
    if (!anbieterDaten) return [];
    return Object.keys(anbieterDaten.statuses)
      .filter((id) => anbieterDaten.statuses[id]?.includes("offer"))
      .map((id) => BLAETTER_NACH_ID.get(id))
      .filter((b): b is Blatt => !!b)
      .sort((a, b) => blattTitel(a).localeCompare(blattTitel(b), "de", { numeric: true }));
  }, [anbieterDaten]);

  /* Stufe 2: NUR Blätter, die ich selbst zum Tauschen markiert habe. */
  const meineTauschblaetter = useMemo(() => {
    if (!benutzer) return [];
    return Object.keys(benutzer.statuses)
      .filter((id) => benutzer.statuses[id]?.includes("offer"))
      .map((id) => BLAETTER_NACH_ID.get(id))
      .filter((b): b is Blatt => !!b)
      .sort((a, b) => blattTitel(a).localeCompare(blattTitel(b), "de", { numeric: true }));
  }, [benutzer]);

  /* Treffer: welche meiner Tauschblätter wünscht sich der Anbieter? Erinnerung an vorherige Einstufung. */
  const treffer = useMemo(() => {
    if (!benutzer || !anbieterDaten) return [] as Blatt[];
    const seineWunsch = new Set(
      Object.keys(anbieterDaten.statuses).filter((id) => anbieterDaten.statuses[id]?.includes("wish")),
    );
    return meineTauschblaetter.filter((b) => seineWunsch.has(b.id));
  }, [benutzer, anbieterDaten, meineTauschblaetter]);

  function paketVorschlag() {
    if (treffer.length === 0) return;
    setNachricht(`Hallo! Ich biete dir dafür: ${treffer.map((b) => `„${blattTitel(b)}“`).join(", ")}. Das alles in einem Brief – spart Porto!`);
  }

  const gefiltert = useMemo(() => {
    const q = suche.trim().toLowerCase();
    if (!q) return meineTauschblaetter;
    return meineTauschblaetter.filter((b) =>
      `${blattTitel(b)} ${b.name ?? ""} ${b.nummer} ${b.groesse}`.toLowerCase().includes(q),
    );
  }, [meineTauschblaetter, suche]);

  if (!blatt || !benutzer) return null;

  const istMein = benutzer.id === anbieter.id;
  const betragZahl = betrag.trim() === "" ? null : Number(betrag.replace(",", "."));
  const kannWeiter = wunschAuswahl.length > 0;
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
      blattId: wunschAuswahl[0] ?? blattId,
      anbieter,
      ich: benutzer,
      eigeneBlatter: auswahl,
      betrag: betragZahl,
      nachricht: nachricht.trim() === "" ? null : nachricht.trim(),
      wunschBlatter: wunschAuswahl,
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/60 p-4 backdrop-blur-sm"
      onClick={aufSchliessen}
      role="dialog"
      aria-modal="true"
      aria-label={`Tauschanfrage bei ${anbieter.name}`}
    >
      <div
        className="animate-pop card-soft flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-candy-100 px-4 py-3">
          <div className="min-w-0">
            <p className="truncate font-display text-lg font-bold text-ink-800">
              {stufe === 1 ? "Was willst du haben?" : "Dein Gegenvorschlag"}
            </p>
            <p className="text-xs font-semibold text-ink-600">
              {stufe === 1 ? (
                <>
                  Tausch mit <span className="font-bold text-candy-600">{anbieter.name}</span>
                </>
              ) : (
                <>
                  Wunschblätter: {wunschAuswahl.length} · (
                  {wunschAuswahl.map((id) => { const b = BLAETTER_NACH_ID.get(id); return b ? blattTitel(b) : id; }).join(", ")}
                  )
                </>
              )}
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
              Deine Anfrage ist raus!
            </p>
            <p className="text-sm text-ink-600">
              {anbieter.name} kann jetzt antworten, anpassen oder ablehnen. Du findest alles unten im Postfach.
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
              Für andere kannst du hier anfragen – dein Angebot verwaltest du über das Postfach.
            </p>
          </div>
        ) : stufe === 1 ? (
          <>
            <div className="space-y-4 overflow-y-auto p-4">
              <div>
                <p className="mb-1.5 text-xs font-bold uppercase tracking-wide text-ink-600">
                  Welche Blätter von {anbieter.name} möchtest du anfragen? (mehrere möglich)
                </p>
                <p className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-semibold text-ink-600">
                  <span className="flex items-center gap-1">
                    <span className="flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500 text-white">
                      <Check className="h-2.5 w-2.5" strokeWidth={3.5} />
                    </span>
                    Hast du schon
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="flex h-4 w-4 items-center justify-center rounded-full bg-berry-400 text-white">
                      <Heart className="h-2.5 w-2.5 fill-current" />
                    </span>
                    Auf deiner Wunschliste
                  </span>
                </p>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {anbieterBlaetter.map((b) => {
                    const aktiv = wunschAuswahl.includes(b.id);
                    const meine = benutzer?.statuses[b.id] ?? [];
                    const habIch = meine.includes("own");
                    const aufWunsch = meine.includes("wish");
                    return (
                      <button
                        key={b.id}
                        type="button"
                        onClick={() =>
                          setWunschAuswahl((vorher) =>
                            aktiv
                              ? vorher.filter((id) => id !== b.id)
                              : [...vorher, b.id].slice(0, 20),
                          )
                        }
                        aria-pressed={aktiv}
                        title={[
                          blattTitel(b),
                          habIch ? "– hast du schon" : "",
                          aufWunsch ? "– auf deiner Wunschliste" : "",
                        ]
                          .filter(Boolean)
                          .join(" ")}
                        className={cn(
                          "flex items-center gap-2 rounded-2xl p-2 text-left transition-all",
                          aktiv
                            ? "bg-candy-500 text-white shadow-sm"
                            : "bg-white text-ink-700 ring-1 ring-cream-300 hover:ring-candy-300",
                        )}
                      >
                        <span className="relative shrink-0">
                          <img
                            src={b.bild}
                            alt=""
                            className={cn(
                              "h-10 w-10 rounded-xl bg-white object-contain",
                              aktiv ? "bg-white/20" : "",
                            )}
                          />
                          {aufWunsch && (
                            <span
                              title="Auf deiner Wunschliste"
                              className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-berry-400 text-white ring-2 ring-white"
                            >
                              <Heart className="h-2.5 w-2.5 fill-current" />
                            </span>
                          )}
                          {habIch && (
                            <span
                              title="Hast du schon in deiner Sammlung"
                              className="absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500 text-white ring-2 ring-white"
                            >
                              <Check className="h-2.5 w-2.5" strokeWidth={3.5} />
                            </span>
                          )}
                        </span>
                        <span className="line-clamp-2 flex-1 text-xs font-bold leading-4">
                          {blattTitel(b)}
                        </span>
                      </button>
                    );
                  })}
                </div>
                {anbieterBlaetter.length === 0 && (
                  <p className="text-xs font-semibold text-ink-600">
                    {anbieter.name} hat aktuell keine Blätter zum Tauschen markiert.
                  </p>
                )}
                {wunschAuswahl.length > 0 && (
                  <p className="mt-2 text-xs font-semibold text-candy-700">
                    {wunschAuswahl.length} {wunschAuswahl.length === 1 ? "Blatt" : "Blätter"} angefragt
                  </p>
                )}
              </div>
            </div>
            <div className="flex items-center justify-between gap-2 border-t border-candy-100 px-4 py-3">
              <button
                type="button"
                onClick={aufSchliessen}
                className="rounded-full bg-white px-4 py-2 text-sm font-bold text-ink-600 ring-1 ring-cream-300 hover:bg-cream-100"
              >
                Abbrechen
              </button>
              <button
                type="button"
                onClick={() => setStufe(2)}
                disabled={!kannWeiter}
                className="flex items-center gap-1.5 rounded-full bg-candy-500 px-5 py-2 text-sm font-bold text-white shadow-sm hover:bg-candy-600 disabled:opacity-40"
              >
                Weiter <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="space-y-4 overflow-y-auto p-4">
              {treffer.length > 0 && (
                <div className="rounded-2xl bg-mint-50 p-3 ring-1 ring-mint-200">
                  <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-emerald-700">
                    <Sparkles className="h-3.5 w-3.5" /> Passende Wünsche
                  </p>
                  <p className="mt-1.5 text-xs font-semibold text-ink-700">
                    Diese Blätter von dir wünscht sich {anbieter.name}:{" "}
                    {treffer.map((b) => `„${blattTitel(b)}“`).join(", ")}
                  </p>
                  <button
                    type="button"
                    onClick={paketVorschlag}
                    className="mt-2 flex items-center gap-1.5 rounded-full bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-700"
                  >
                    <Gift className="h-3.5 w-3.5" /> Paket-Vorschlag in die Nachricht
                  </button>
                </div>
              )}
              <div>
                <p className="mb-1 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-ink-600">
                  <Search className="h-3.5 w-3.5" /> Eigene Tauschblätter bieten (mehrere möglich)
                </p>
                <input
                  value={suche}
                  onChange={(e) => setSuche(e.target.value)}
                  placeholder={`Suche in deinen ${meineTauschblaetter.length} Tauschblättern …`}
                  className="w-full rounded-full border border-cream-300 bg-white px-3 py-2 text-sm font-semibold outline-none focus:border-candy-400 focus:ring-2 focus:ring-candy-200"
                />
                <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {gefiltert.map((b) => {
                    const aktiv = auswahl.includes(b.id);
                    const aufWunsch = treffer.some((t) => t.id === b.id);
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
                        title={
                          aufWunsch
                            ? `Steht bei ${anbieter.name} auf der Wunschliste`
                            : undefined
                        }
                        className={cn(
                          "flex items-center gap-2 rounded-2xl p-2 text-left transition-all",
                          aktiv
                            ? "bg-candy-500 text-white shadow-sm"
                            : "bg-white text-ink-700 ring-1 ring-cream-300 hover:ring-candy-300",
                          aufWunsch &&
                            !aktiv &&
                            "bg-yellow-50 ring-2 ring-yellow-400 hover:ring-yellow-500",
                        )}
                      >
                        <img
                          src={b.bild}
                          alt=""
                          className={cn(
                            "h-10 w-10 shrink-0 rounded-xl bg-white object-contain",
                            aktiv ? "bg-white/20" : "",
                          )}
                        />
                        <span className="line-clamp-2 flex-1 text-xs font-bold leading-4">
                          {blattTitel(b)}
                          {aufWunsch && (
                            <Star className="ml-1 inline h-3 w-3 -translate-y-px fill-yellow-400 text-yellow-400" />
                          )}
                        </span>
                      </button>
                    );
                  })}
                  {gefiltert.length === 0 && (
                    <p className="col-span-full text-xs font-semibold text-ink-600">
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
                  Oder Geldbetrag (€) – auch statt Blättern möglich
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
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setStufe(1)}
                  className="rounded-full bg-white px-4 py-2 text-sm font-bold text-ink-600 ring-1 ring-cream-300 hover:bg-cream-100"
                >
                  Zurück
                </button>
                <p className="hidden text-xs font-semibold text-ink-600 sm:block">
                  {auswahl.length === 0
                    ? "Wähle Blätter oder einen Betrag."
                    : `${auswahl.length} Blatt${auswahl.length === 1 ? "" : "er"}${betragZahl ? " + " + betragZahl.toLocaleString("de-DE", { style: "currency", currency: "EUR" }) : ""}`}
                </p>
              </div>
              <button
                type="button"
                onClick={() => void absenden()}
                disabled={!kannSenden}
                className="rounded-full bg-candy-500 px-5 py-2 text-sm font-bold text-white shadow-sm hover:bg-candy-600 disabled:opacity-40"
              >
                <Send className="mr-1 inline h-4 w-4" /> Anfrage senden
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { BellRing, Loader2 } from "lucide-react";
import { getSession } from "@/lib/store";
import { istAdmin } from "@/lib/kontakt";
import { ladeHinweis, speichereHinweis } from "@/lib/hinweis";
import { cn } from "@/lib/utils";

const TEXT_MAX = 120;

export function HinweisEditor() {
  const ich = getSession();
  const [text, setText] = useState("");
  const [link, setLink] = useState("");
  const [aktiv, setAktiv] = useState(false);
  const [sendet, setSendet] = useState(false);
  const [erfolg, setErfolg] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);

  useEffect(() => {
    let lebendig = true;
    void ladeHinweis(true).then((h) => {
      if (!lebendig || !h) return;
      setText(h.text);
      setLink(h.link ?? "");
      setAktiv(h.aktiv);
    });
    return () => {
      lebendig = false;
    };
  }, []);

  if (!ich || !istAdmin(ich.name)) return null;

  function normalisiereLink(wert: string): string | null {
    const sauber = wert.trim();
    if (!sauber) return null;
    return /:\/\//.test(sauber) ? sauber : `https://${sauber}`;
  }

  async function absenden(e: React.FormEvent) {
    e.preventDefault();
    if (sendet) return;
    setFehler(null);
    setErfolg(false);
    if (aktiv && (text.trim().length < 1 || text.trim().length > TEXT_MAX)) {
      setFehler(`Aktiver Hinweis braucht 1 bis ${TEXT_MAX} Zeichen Text.`);
      return;
    }
    if (text.trim().length > TEXT_MAX) {
      setFehler(`Der Text ist zu lang (max. ${TEXT_MAX} Zeichen).`);
      return;
    }
    setSendet(true);
    const ergebnis = await speichereHinweis(text.trim(), normalisiereLink(link), aktiv);
    setSendet(false);
    if (ergebnis.ok) {
      setErfolg(true);
      return;
    }
    setFehler(ergebnis.fehler ?? "Das hat nicht geklappt.");
  }

  return (
    <div className="card-soft p-5">
      <h3 className="font-display flex items-center gap-2 text-lg font-bold text-ink-800">
        <BellRing className="h-5 w-5 text-candy-500" />
        Hinweis-Button
      </h3>
      <p className="mt-1 text-xs font-semibold text-ink-600">
        Schwebender Button rechts unten für eingeloggte Sammler – z. B. „Blöcke verfügbar“. Ausgeschaltet
        ist er überall komplett unsichtbar.
      </p>
      <form onSubmit={(e) => void absenden(e)} className="mt-3 space-y-3">
        <button
          type="button"
          onClick={() => setAktiv(!aktiv)}
          aria-pressed={aktiv}
          className={cn(
            "flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-bold transition-all",
            aktiv ? "bg-emerald-600 text-white shadow-sm" : "bg-white text-ink-700 ring-1 ring-cream-300 hover:ring-candy-300",
          )}
        >
          <span className={cn("h-2.5 w-2.5 rounded-full", aktiv ? "bg-white" : "bg-cream-300")} />
          {aktiv ? "Eingeschaltet" : "Ausgeschaltet"}
        </button>
        <label className="block">
          <span className="mb-1 block text-xs font-bold text-ink-700">
            Text ({text.trim().length}/{TEXT_MAX})
          </span>
          <input
            value={text}
            onChange={(e) => setText(e.target.value.slice(0, TEXT_MAX))}
            placeholder="z. B. Blöcke verfügbar"
            className="w-full rounded-2xl border border-cream-300 bg-white px-3.5 py-2.5 text-sm font-semibold text-ink-800 outline-none focus:border-candy-400 focus:ring-2 focus:ring-candy-200"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-bold text-ink-700">Link (optional)</span>
          <input
            value={link}
            onChange={(e) => setLink(e.target.value.slice(0, 500))}
            placeholder="z. B. /shop oder https:// …"
            inputMode="url"
            className="w-full rounded-2xl border border-cream-300 bg-white px-3.5 py-2.5 text-sm font-semibold text-ink-800 outline-none focus:border-candy-400 focus:ring-2 focus:ring-candy-200"
          />
        </label>
        {fehler && (
          <p className="rounded-2xl bg-peach-100 px-3.5 py-2.5 text-sm font-bold text-peach-600">{fehler}</p>
        )}
        {erfolg && (
          <p className="rounded-2xl bg-mint-100 px-3.5 py-2.5 text-sm font-bold text-emerald-800">
            Gespeichert – der Button erscheint bei allen eingeloggten Sammlern.
          </p>
        )}
        <button
          type="submit"
          disabled={sendet}
          className="flex items-center gap-1.5 rounded-full bg-candy-500 px-5 py-2.5 text-sm font-bold text-white hover:bg-candy-600 disabled:opacity-40"
        >
          {sendet && <Loader2 className="h-4 w-4 animate-spin" />}
          {sendet ? "Wird gespeichert …" : "Hinweis speichern"}
        </button>
      </form>
    </div>
  );
}

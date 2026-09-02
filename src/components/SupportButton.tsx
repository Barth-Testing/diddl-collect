"use client";

import { useState } from "react";
import Link from "next/link";
import { Headset, X } from "lucide-react";
import { KontaktFormular } from "./KontaktFormular";

export function SupportButton() {
  const [offen, setOffen] = useState(false);

  return (
    <div className="fixed bottom-4 right-4 z-30 flex flex-col items-end gap-2 print:hidden">
      {offen && (
        <div className="animate-pop card-soft w-80 max-w-[calc(100vw-2rem)] p-5 shadow-xl">
          <div className="mb-3 flex items-start justify-between gap-2">
            <div>
              <p className="font-display text-sm font-bold text-ink-800">Hilfe &amp; Kontakt</p>
              <p className="mt-0.5 text-xs font-semibold text-ink-600">
                Deine Nachricht geht direkt an den Betreiber.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setOffen(false)}
              aria-label="Schließen"
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-cream-100 text-ink-600 hover:bg-berry-100"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          <KontaktFormular modus="modal" />
          <Link
            href="/kontakt"
            onClick={() => setOffen(false)}
            className="mt-2 block text-center text-xs font-semibold text-berry-500 underline decoration-berry-200 underline-offset-2 hover:text-berry-600"
          >
            Zur Kontakt-Seite
          </Link>
        </div>
      )}
      <button
        type="button"
        onClick={() => setOffen(!offen)}
        aria-label="Hilfe und Kontakt"
        title="Hilfe und Kontakt"
        className="flex h-12 w-36 items-center justify-center gap-1.5 rounded-full bg-berry-400 px-4 text-sm font-bold text-white shadow-lg shadow-berry-300/40 transition-transform hover:scale-105 hover:bg-berry-500"
      >
        <Headset className="h-4 w-4" />
        <span className={offen ? "hidden" : "inline"}>Hilfe</span>
      </button>
    </div>
  );
}

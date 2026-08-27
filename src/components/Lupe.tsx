"use client";

import { X, ExternalLink } from "lucide-react";
import type { Blatt, Status } from "@/lib/types";
import { cn } from "@/lib/utils";
import { farbBadge, blattTitel } from "@/lib/blaetter";

type Props = {
  blatt: Blatt;
  status: Status[];
  aufSchliessen: () => void;
  aufToggle: (status: "own" | "wish" | "offer") => void;
};

export function Lupe({ blatt, status, aufSchliessen, aufToggle }: Props) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/60 p-4 backdrop-blur-sm"
      onClick={aufSchliessen}
      role="dialog"
      aria-modal="true"
      aria-label={`Motiv: ${blattTitel(blatt)}`}
    >
      <div
        className="animate-pop card-soft flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-candy-100 px-4 py-3">
          <div className="min-w-0">
            <p className="truncate font-display text-lg font-bold text-ink-800">{blattTitel(blatt)}</p>
            <p className="text-xs font-semibold text-ink-600">
              <span className={cn("chip px-1.5", farbBadge(blatt.farbe))}>{blatt.farbe}</span>
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

        <div className="flex items-center justify-center bg-white p-4">
          <img
            src={blatt.bildGross}
            alt={blattTitel(blatt)}
            onError={(e) => {
              (e.target as HTMLImageElement).src = blatt.bild;
            }}
            className="max-h-[55vh] w-auto rounded-xl object-contain shadow-md"
          />
        </div>

        <div className="flex items-center justify-between gap-2 border-t border-candy-100 px-4 py-3">
          <div className="flex gap-1.5">
            <button
              onClick={() => aufToggle("own")}
              aria-pressed={status.includes("own")}
              className={cn(
                "rounded-full px-3 py-1.5 text-xs font-bold transition-all",
                status.includes("own")
                  ? "bg-candy-500 text-white shadow-sm"
                  : "bg-white text-ink-600 ring-1 ring-cream-300 hover:ring-candy-300",
              )}
            >
              ✓ Hab ich
            </button>
            <button
              onClick={() => aufToggle("wish")}
              aria-pressed={status.includes("wish")}
              className={cn(
                "rounded-full px-3 py-1.5 text-xs font-bold transition-all",
                status.includes("wish")
                  ? "bg-berry-400 text-white shadow-sm"
                  : "bg-white text-ink-600 ring-1 ring-cream-300 hover:ring-berry-200",
              )}
            >
              ♥ Wunsch
            </button>
            <button
              onClick={() => aufToggle("offer")}
              aria-pressed={status.includes("offer")}
              className={cn(
                "rounded-full px-3 py-1.5 text-xs font-bold transition-all",
                status.includes("offer")
                  ? "bg-peach-400 text-white shadow-sm"
                  : "bg-white text-ink-600 ring-1 ring-cream-300 hover:ring-peach-200",
              )}
            >
              ⇄ Tauschen
            </button>
          </div>
          <a
            href={blatt.quelle}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-xs font-bold text-candy-600 hover:text-candy-700"
          >
            Quelle <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      </div>
    </div>
  );
}
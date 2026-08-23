"use client";

import { Check, Heart, Repeat2, Camera, Star } from "lucide-react";
import type { Blatt, Status } from "@/lib/types";
import { cn } from "@/lib/utils";
import { farbBadge, nameOderNummer } from "@/lib/blaetter";

export type BlattAktion = "own" | "wish" | "offer";

type Props = {
  blatt: Blatt;
  status: Status | null;
  bewiesen?: boolean;
  bildOverride?: string;
  favorit?: boolean;
  aufToggle: (status: BlattAktion) => void;
  aufBild: () => void;
  aufBeweis?: () => void;
  aufFavorit?: () => void;
};

export function BlattKarte({
  blatt,
  status,
  bewiesen,
  bildOverride,
  favorit,
  aufToggle,
  aufBild,
  aufBeweis,
  aufFavorit,
}: Props) {
  return (
    <div
      className={cn(
        "card-soft animate-pop relative flex flex-col overflow-hidden transition-transform hover:-translate-y-0.5",
        favorit && "outline outline-[3px] outline-offset-2 outline-yellow-400",
        status === "own" && "ring-2 ring-candy-400",
        status === "wish" && "ring-2 ring-berry-300",
        status === "offer" && "ring-2 ring-peach-300",
      )}
    >
      <button
        onClick={aufBild}
        className="group relative block aspect-square w-full overflow-hidden bg-white"
        aria-label={`Motiv von ${nameOderNummer(blatt)} vergrößern`}
      >
        <img
          src={bildOverride ?? blatt.bild}
          alt={nameOderNummer(blatt)}
          loading="lazy"
          className="absolute inset-0 h-full w-full object-contain p-2 transition-transform duration-300 group-hover:scale-105"
        />
        {status === "own" && (
          <span className="chip absolute left-2 top-2 bg-candy-500 px-2 py-0.5 text-white shadow-sm">
            <Check className="h-3 w-3" /> Hab ich
          </span>
        )}
        {status === "wish" && (
          <span className="chip absolute left-2 top-2 bg-berry-400 px-2 py-0.5 text-white shadow-sm">
            <Heart className="h-3 w-3" /> Wunsch
          </span>
        )}
        {status === "offer" && (
          <span className="chip absolute left-2 top-2 bg-peach-400 px-2 py-0.5 text-white shadow-sm">
            <Repeat2 className="h-3 w-3" /> Tausch
          </span>
        )}
        {favorit && (
          <span className="chip absolute right-2 top-2 bg-yellow-400 px-1.5 py-0.5 text-white shadow-sm">
            <Star className="h-3 w-3 fill-current" /> Top
          </span>
        )}
      </button>

      <div className="flex flex-1 flex-col gap-1.5 p-2.5">
        <p className="line-clamp-1 text-xs font-bold text-ink-800" title={nameOderNummer(blatt)}>
          {nameOderNummer(blatt)}
        </p>
        <div className="flex flex-wrap items-center gap-1">
          <span className="chip bg-cream-100 px-1.5 py-0.5 text-ink-700">
            {blatt.groesse.replace("Din ", "")}
          </span>
          <span className="chip bg-candy-100 px-1.5 py-0.5 text-candy-700">{blatt.jahr}</span>
          <span className={cn("chip px-1.5 py-0.5", farbBadge(blatt.farbe))}>{blatt.farbe}</span>
          {bewiesen && (
            <span className="chip bg-mint-200 px-1.5 py-0.5 text-[10px] text-emerald-800">✓ Beweis</span>
          )}
        </div>

        <div className="mt-auto flex items-center justify-between gap-1 border-t border-candy-100 pt-1.5">
          <div className="flex gap-1">
            <Button
              aktiv={status === "own"}
              aktivCls="bg-candy-500 text-white shadow-sm ring-candy-400"
              titel="In meiner Sammlung"
              aria={`${nameOderNummer(blatt)}: Hab ich markieren oder entfernen`}
              onClick={() => aufToggle("own")}
            >
              <Check className="h-3.5 w-3.5" />
            </Button>
            <Button
              aktiv={status === "wish"}
              aktivCls="bg-berry-400 text-white shadow-sm ring-berry-300"
              titel="Auf die Wunschliste"
              aria={`${nameOderNummer(blatt)}: Wunsch markieren oder entfernen`}
              onClick={() => aufToggle("wish")}
            >
              <Heart className="h-3.5 w-3.5" />
            </Button>
            <Button
              aktiv={status === "offer"}
              aktivCls="bg-peach-400 text-white shadow-sm ring-peach-300"
              titel="Doppelt – zum Tauschen anbieten"
              aria={`${nameOderNummer(blatt)}: Zum Tauschen markieren oder entfernen`}
              onClick={() => aufToggle("offer")}
            >
              <Repeat2 className="h-3.5 w-3.5" />
            </Button>
          </div>
          <div className="flex gap-1">
            {aufBeweis && (
              <Button
                aktiv={!!bewiesen}
                aktivCls="bg-mint-300 text-emerald-900 shadow-sm"
                titel={bewiesen ? "Beweis vorhanden" : "Foto als Besitz-Beweis hochladen"}
                aria="Besitz-Beweis hochladen"
                onClick={aufBeweis}
              >
                <Camera className="h-3.5 w-3.5" />
              </Button>
            )}
            {aufFavorit && (
              <Button
                aktiv={!!favorit}
                aktivCls="bg-yellow-400 text-white shadow-sm"
                titel={favorit ? "Von den Top-Favoriten entfernen" : "Zu den Top-Favoriten hinzufügen"}
                aria={`${nameOderNummer(blatt)}: Als Top-Favorit markieren oder entfernen`}
                onClick={aufFavorit}
              >
                <Star className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Button({
  children,
  aktiv,
  aktivCls,
  titel,
  aria,
  onClick,
}: {
  children: React.ReactNode;
  aktiv: boolean;
  aktivCls?: string;
  titel: string;
  aria?: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      title={titel}
      aria-label={aria ?? titel}
      aria-pressed={aktiv}
      className={cn(
        "flex h-7 w-7 items-center justify-center rounded-full text-ink-600 transition-all hover:scale-110",
        aktiv ? (aktivCls ?? "bg-candy-500 text-white shadow-sm") : "bg-white ring-1 ring-cream-300 hover:ring-candy-300",
      )}
    >
      {children}
    </button>
  );
}
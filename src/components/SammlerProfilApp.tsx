"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { SearchX, Trophy } from "lucide-react";
import { getSession, listBenutzer, zaehle } from "@/lib/store";
import { useStoreVersion } from "@/lib/useStoreVersion";
import { Punkte } from "./Punkte";
import { SammlerKarussell } from "./SammlerKarussell";

export function SammlerProfilApp() {
  const version = useStoreVersion();
  const params = useSearchParams();
  const name = (params.get("name") ?? "").trim();
  const ich = getSession();

  void version;
  const q = name.toLowerCase();
  const benutzer = name ? (listBenutzer().find((u) => u.name.toLowerCase() === q) ?? null) : null;

  if (!name || !benutzer) {
    return (
      <div className="mt-6 space-y-4">
        <div className="card-soft flex flex-col items-center gap-2 p-10 text-center text-ink-600">
          <SearchX className="h-8 w-8 text-candy-300" />
          <p className="font-display text-lg font-bold">
            {name ? `Kein Profil für „${name}“ gefunden.` : "Kein Sammler ausgewählt."}
          </p>
          <p className="text-sm">
            Vielleicht lädt die Seite noch – oder du schaust direkt in der{" "}
            <Link href="/rangliste" className="font-bold text-candy-600 hover:underline">
              Rangliste
            </Link>{" "}
            vorbei.
          </p>
        </div>
      </div>
    );
  }

  const z = zaehle(benutzer);

  return (
    <div className="mt-6 space-y-5">
      <div className="card-soft flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
        <div className="flex items-center gap-3">
          <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-berry-400 font-display text-2xl font-black text-white">
            {benutzer.name.slice(0, 1).toUpperCase()}
          </span>
          <div>
            <p className="font-display text-xl font-bold text-ink-800">{benutzer.name}</p>
            <p className="text-xs font-semibold text-ink-600">
              Sammler seit {new Date(benutzer.createdAt).toLocaleDateString("de-DE")}
            </p>
          </div>
        </div>
        <div className="grid flex-1 grid-cols-2 gap-2 sm:grid-cols-4">
          <Punkte label="Eigene Blätter" wert={z.own} farbe="text-candy-500" />
          <Punkte label="Wunschliste" wert={z.wish} farbe="text-berry-400" />
          <Punkte label="Zum Tauschen" wert={z.offer} farbe="text-peach-500" />
          <Punkte label="Bewiesen" wert={z.beweise} farbe="text-emerald-600" />
        </div>
        {ich?.id === benutzer.id && (
          <Link
            href="/konto"
            className="shrink-0 self-start rounded-full bg-candy-500 px-4 py-2 text-sm font-bold text-white hover:bg-candy-600 sm:self-auto"
          >
            Zur eigenen Sammlung
          </Link>
        )}
      </div>

      <SammlerKarussell benutzer={benutzer} titel={`${benutzer.name}s Lieblingsblätter`} />

      <p className="flex items-center justify-center gap-1.5 text-center text-xs font-semibold text-ink-600">
        <Trophy className="h-3.5 w-3.5 text-candy-500" />
        Alle Sammler findest du in der{" "}
        <Link href="/rangliste" className="text-candy-600 hover:underline">
          Rangliste
        </Link>
        .
      </p>
    </div>
  );
}

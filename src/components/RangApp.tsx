"use client";

import Link from "next/link";
import { Medal, ShieldAlert, ShieldCheck } from "lucide-react";
import { berechneRangliste, getSession } from "@/lib/store";
import { useStoreVersion } from "@/lib/useStoreVersion";
import { cn } from "@/lib/utils";

export function RangApp() {
  useStoreVersion();
  const benutzer = getSession();
  const eintraege = berechneRangliste();

  const meinEintrag = benutzer ? eintraege.find((e) => e.benutzer.id === benutzer.id) : null;
  const ersteBlockadeIndex = eintraege.findIndex((e) => !e.freigeschaltet);

  return (
    <div className="mt-6 space-y-4">
      {meinEintrag && (
        <div className="card-soft flex items-center gap-3 border-candy-200 bg-candy-50 px-4 py-3 text-sm font-semibold text-ink-800">
          <Medal className="h-5 w-5 text-candy-500" />
          {meinEintrag.freigeschaltet ? (
            <span>
              Du stehst aktuell auf <span className="text-candy-600">Platz {meinEintrag.rang}</span> mit{" "}
              {meinEintrag.own} {meinEintrag.own === 1 ? "Punkt" : "Punkten"} und {meinEintrag.beweise}{" "}
              {meinEintrag.beweise === 1 ? "Beweis" : "Beweisen"}.
            </span>
          ) : (
            <span>
              Du hast {meinEintrag.own} Punkte, aber nur {meinEintrag.beweise} Beweise – für Plätze
              über Rang 100 brauchst du 100 bewiesene Blätter.
            </span>
          )}
          <Link href="/konto" className="ml-auto shrink-0 rounded-full bg-candy-500 px-3 py-1.5 text-xs font-bold text-white hover:bg-candy-600">
            Zur Sammlung
          </Link>
        </div>
      )}
      {!benutzer && (
        <div className="card-soft px-4 py-3 text-sm font-semibold text-ink-600">
          Noch nicht dabei?{" "}
          <Link href="/konto" className="font-bold text-candy-600 hover:underline">
            Leg dir ein Sammlerkonto an
          </Link>{" "}
          – dann erscheinst du hier automatisch.
        </div>
      )}

      <div className="card-soft overflow-x-auto">
        <table className="w-full min-w-[540px] text-sm">
          <thead>
            <tr className="border-b border-candy-100 text-left text-xs uppercase tracking-wide text-ink-600">
              <th className="px-4 py-3">Platz</th>
              <th className="px-4 py-3">Sammler</th>
              <th className="px-4 py-3 text-center">Punkte</th>
              <th className="px-4 py-3 text-center">Wunsch</th>
              <th className="px-4 py-3 text-center">Tausch</th>
              <th className="px-4 py-3 text-center">Bewiesen</th>
            </tr>
          </thead>
          <tbody>
            {eintraege.map((e) => {
              const istIch = benutzer?.id === e.benutzer.id;
              return (
                <tr
                  key={e.benutzer.id}
                  className={cn(
                    "border-b border-cream-100 last:border-0",
                    istIch && "bg-candy-100/60",
                  )}
                >
                  <td className="px-4 py-2.5 font-display font-bold text-ink-700">
                    {e.rang <= 3 ? (
                      <span
                        className={cn(
                          "flex h-7 w-7 items-center justify-center rounded-full text-sm text-white",
                          e.rang === 1 && "bg-yellow-400",
                          e.rang === 2 && "bg-stone-300",
                          e.rang === 3 && "bg-orange-300",
                        )}
                      >
                        {e.rang}
                      </span>
                    ) : (
                      e.rang
                    )}
                  </td>
                  <td className="px-4 py-2.5 font-bold text-ink-800">
                    {e.benutzer.name}
                    {istIch && <span className="chip ml-2 bg-candy-500 px-1.5 py-0.5 text-white">Du</span>}
                  </td>
                  <td className="px-4 py-2.5 text-center">
                    <span className="font-display font-bold text-candy-600">{e.own}</span>
                  </td>
                  <td className="px-4 py-2.5 text-center">{e.wish}</td>
                  <td className="px-4 py-2.5 text-center">{e.offer}</td>
                  <td className="px-4 py-2.5 text-center">
                    {e.freigeschaltet ? (
                      <span className="chip bg-mint-100 px-1.5 py-0.5 text-emerald-700">
                        <ShieldCheck className="h-3 w-3" />
                        {e.beweise}
                      </span>
                    ) : (
                      <span className="chip bg-peach-100 px-1.5 py-0.5 text-peach-600">
                        <ShieldAlert className="h-3 w-3" />
                        {e.beweise} / 100 nötig
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {ersteBlockadeIndex > -1 && (
        <div className="card-soft flex items-center gap-3 border-peach-300 bg-peach-50 px-4 py-3 text-sm font-semibold text-ink-800">
          <ShieldAlert className="h-5 w-5 shrink-0 text-peach-500" />
          <span>
            Ab hier (Rang {ersteBlockadeIndex + 1}) warten Sammler mit über 100 Blättern, die ihre
            Beweise noch nicht beigebracht haben. Sobald sie 100 Blätter per Foto belegen, rücken
            sie nach oben – ohne Schummel-Ehren.
          </span>
        </div>
      )}

      <p className="text-center text-xs text-ink-600">
        Hier zählt nur dein eigenes Konto – deine Daten sind sicher gespeichert und auf jedem Gerät da.
      </p>
    </div>
  );
}
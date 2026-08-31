"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { Gem, HeartHandshake, Medal, ShieldAlert, ShieldCheck } from "lucide-react";
import { getSupabase } from "@/lib/supabase";
import { aktualisiereSupporter, berechneRangliste, getSession, listBenutzer } from "@/lib/store";
import { useStoreVersion } from "@/lib/useStoreVersion";
import { cn } from "@/lib/utils";

type EhrungsDb = {
  public: {
    Tables: {
      spender_ehrungen: {
        Row: { id: number; name: string; erstellt_am: string };
        Insert: { name: string };
        Update: never;
        Relationships: [];
      };
    };
  };
};

export function RangApp() {
  useStoreVersion();
  const benutzer = getSession();
  const eintraege = berechneRangliste();
  const supporter = listBenutzer().filter((u) => u.supporter);
  const [ehrungen, setEhrungen] = useState<string[]>([]);

  useEffect(() => {
    void aktualisiereSupporter();
    const supabase = getSupabase<EhrungsDb>();
    if (supabase) {
      ladeEhrungen(supabase).then((namen) => setEhrungen(namen));
    }
  }, []);

  const meinEintrag = benutzer ? eintraege.find((e) => e.benutzer.id === benutzer.id) : null;

  return (
    <div className="mt-6 space-y-4">
      {(supporter.length > 0 || ehrungen.length > 0) && (
        <div className="card-soft border-yellow-200 bg-gradient-to-r from-yellow-50 via-amber-50 to-yellow-50 p-5">
          <h2 className="font-display flex items-center gap-2 text-lg font-bold text-ink-800">
            <HeartHandshake className="h-5 w-5 text-yellow-500" />
            Danke an unsere Unterstützer!
          </h2>
          <p className="mt-1 text-xs font-semibold text-ink-600">
            Diese Sammler halten die Seite mit einer Spende am Laufen – herzlichen Dank!
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {supporter.map((u) => (
              <Link
                key={u.id}
                href={`/sammler?id=${encodeURIComponent(u.id)}&name=${encodeURIComponent(u.name)}&ht=1`}
                className="chip gap-1.5 bg-white px-3 py-1.5 text-sm font-bold text-ink-800 ring-1 ring-yellow-300 hover:bg-yellow-100"
              >
                <Gem className="h-3.5 w-3.5 text-yellow-500" />
                {u.name}
              </Link>
            ))}
            {ehrungen.map((name) => (
              <span
                key={name}
                className="chip gap-1.5 bg-white px-3 py-1.5 text-sm font-bold text-ink-800 ring-1 ring-yellow-300"
                title="Spender ohne Konto – von der Seite geehrt"
              >
                <Gem className="h-3.5 w-3.5 text-yellow-500" />
                {name}
              </span>
            ))}
          </div>
        </div>
      )}

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
              Du hast {meinEintrag.own} Blätter und wirst vorläufig mit{" "}
              <span className="text-candy-600">100 Punkten</span> auf Platz {meinEintrag.rang}
              gewertet – ab {100 - meinEintrag.beweise} weiteren Beweisen zählen alle deine Punkte.
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
                    e.benutzer.supporter &&
                      "bg-yellow-50 outline outline-2 outline-yellow-300",
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
                  <Link
                    href={`/sammler?id=${encodeURIComponent(e.benutzer.id)}&name=${encodeURIComponent(e.benutzer.name)}&ht=1`}
                    className="hover:text-candy-600 hover:underline"
                  >
                    {e.benutzer.name}
                  </Link>
                    {e.benutzer.supporter && (
                      <span
                        className="chip ml-2 bg-yellow-400 px-1.5 py-0.5 text-white"
                        title="Unterstützer: hält die Seite mit einer Spende am Laufen"
                      >
                        <Gem className="h-3 w-3" /> Supporter
                      </span>
                    )}
                    {istIch && <span className="chip ml-2 bg-candy-500 px-1.5 py-0.5 text-white">Du</span>}
                  </td>
                  <td className="px-4 py-2.5 text-center">
                    <span
                      className={cn(
                        "font-display font-bold",
                        e.freigeschaltet ? "text-candy-600" : "text-peach-500",
                      )}
                      title={
                        e.freigeschaltet
                          ? undefined
                          : "Vorläufig auf 100 Punkte begrenzt – 100 Beweise nötig"
                      }
                    >
                      {e.punkte}
                    </span>
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

      <div className="card-soft flex items-center gap-3 border-peach-300 bg-peach-50 px-4 py-3 text-sm font-semibold text-ink-800">
        <ShieldAlert className="h-5 w-5 shrink-0 text-peach-500" />
        <span>
          Mehr als 100 Blätter ohne Nachweis? Diese Sammlungen zählen vorläufig mit genau 100
          Punkten und stehen ganz normal im Feld. Ab 100 hochgeladenen Foto-Beweisen zählen alle
          Punkte – so bleiben die Plätze ehrlich.
        </span>
      </div>

      <p className="text-center text-xs text-ink-600">
        Hier zählt nur dein eigenes Konto – deine Daten sind sicher gespeichert und auf jedem Gerät da.
      </p>
    </div>
  );
}
/** Freitext-Spender (Spenden ohne Konto) laden – Tabelle fehlt? → leere Liste. */
async function ladeEhrungen(supabase: SupabaseClient<EhrungsDb>): Promise<string[]> {
  const { data, error } = await supabase
    .from("spender_ehrungen")
    .select("name")
    .order("erstellt_am", { ascending: true });
  if (error || !data) return [];
  return (data as unknown as { name: string }[]).map((r) => r.name);
}

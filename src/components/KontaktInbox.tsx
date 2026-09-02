"use client";

import { useEffect, useState } from "react";
import { Inbox, Reply, Trash2 } from "lucide-react";
import { kontaktLoeschen, ladeKontakt, type KontaktReihe } from "@/lib/kontakt";

export function KontaktInbox() {
  const [nachrichten, setNachrichten] = useState<KontaktReihe[] | null>(null);

  useEffect(() => {
    let aktiv = true;
    ladeKontakt().then((liste) => {
      if (aktiv) setNachrichten(liste);
    });
    return () => {
      aktiv = false;
    };
  }, []);

  async function aktualisieren() {
    setNachrichten(await ladeKontakt());
  }

  async function loeschen(id: number) {
    if (!confirm("Diese Kontaktanfrage wirklich löschen?")) return;
    await kontaktLoeschen(id);
    void aktualisieren();
  }

  return (
    <div className="card-soft flex flex-col gap-3 p-5">
      <div className="flex items-center gap-2">
        <Inbox className="h-5 w-5 text-berry-400" />
        <h2 className="font-display text-lg font-bold text-ink-800">Eingehende Kontaktanfragen</h2>
      </div>

      {nachrichten === null ? (
        <p className="text-sm font-semibold text-ink-600">Wird geladen …</p>
      ) : nachrichten.length === 0 ? (
        <p className="text-sm font-semibold text-ink-600">Keine Kontaktanfragen vorhanden.</p>
      ) : (
        <ul className="space-y-3">
          {nachrichten.map((n) => (
            <li key={n.id} className="rounded-2xl bg-cream-100 p-4">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <span className="font-display text-sm font-bold text-ink-800">{n.name}</span>
                <span className="ml-auto text-[11px] font-semibold text-ink-500">
                  {new Date(n.erstellt_am).toLocaleString("de-DE")}
                </span>
                <button
                  type="button"
                  onClick={() => void loeschen(n.id)}
                  aria-label="Löschen"
                  className="flex h-7 w-7 items-center justify-center rounded-full bg-white text-ink-500 hover:bg-berry-100 hover:text-berry-600"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
              {n.email && (
                <a
                  href={`mailto:${n.email}?subject=${encodeURIComponent(`Re: ${n.betreff ?? "Deine Kontaktanfrage"}`)}`}
                  className="mt-2 flex flex-wrap items-center gap-2 rounded-xl bg-white px-3 py-2 ring-1 ring-berry-200 transition hover:bg-berry-50"
                  title={`Antwort an ${n.email} schreiben`}
                >
                  <Reply className="h-4 w-4 shrink-0 text-berry-500" />
                  <span className="text-sm font-bold text-ink-800">Antwort an:</span>
                  <span className="break-all text-sm font-semibold text-berry-600 underline decoration-berry-200 underline-offset-2">
                    {n.email}
                  </span>
                </a>
              )}
              {n.betreff && (
                <p className="mt-2 text-sm font-bold text-ink-800">Betreff: {n.betreff}</p>
              )}
              <p className="mt-1 whitespace-pre-wrap text-sm text-ink-700">{n.text}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

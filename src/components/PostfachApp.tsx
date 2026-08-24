"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Check, Handshake, Lock, Repeat2, Send, X } from "lucide-react";
import { BLAETTER_NACH_ID } from "@/lib/blaetter";
import { getSession } from "@/lib/store";
import { useStoreVersion } from "@/lib/useStoreVersion";
import {
  markiereGelesen,
  meineAngebote,
  postZu,
  sendePost,
  setzeAngebotStatus,
  subscribeTausch,
  tauschBereit,
  tauschKonfiguriert,
  verbindeTausch,
  type TauschAngebot,
} from "@/lib/tausch";
import { cn } from "@/lib/utils";

function formatiereZeit(ts: number) {
  return new Date(ts).toLocaleString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function StatusChip({ status }: { status: string }) {
  const map: Record<string, string> = {
    offen: "bg-candy-100 text-candy-700",
    angenommen: "bg-mint-100 text-emerald-700",
    abgelehnt: "bg-peach-100 text-peach-600",
    storniert: "bg-cream-200 text-ink-600",
  };
  const label: Record<string, string> = {
    offen: "Offen",
    angenommen: "Angenommen",
    abgelehnt: "Abgelehnt",
    storniert: "Storniert",
  };
  return (
    <span className={cn("chip px-1.5 py-0.5 text-[10px]", map[status] ?? "bg-cream-200 text-ink-600")}>
      {label[status] ?? status}
    </span>
  );
}

export function PostfachApp() {
  useStoreVersion();
  const ich = getSession();
  const [version, setVersion] = useState(0);
  const [auswahl, setAuswahl] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [sendet, setSendet] = useState(false);
  const [nurOffen, setNurOffen] = useState(false);
  const endeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const cleanup = verbindeTausch();
    const remove = subscribeTausch(() => setVersion((v) => v + 1));
    return () => {
      remove();
      cleanup();
    };
  }, []);

  const alle = ich ? meineAngebote(ich) : [];
  const angebote = alle.filter((a) => !nurOffen || a.status === "offen");
  const gewaehlt = alle.find((a) => a.id === auswahl) ?? null;
  const nachrichten = gewaehlt ? postZu(gewaehlt.id) : [];

  useEffect(() => {
    if (gewaehlt) markiereGelesen(gewaehlt.id);
  }, [gewaehlt, version]);

  useEffect(() => {
    if (nachrichten.length > 0) {
      endeRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    }
  }, [nachrichten.length]);

  if (!ich) {
    return (
      <div className="card-soft flex flex-col items-center gap-2 p-10 text-center text-ink-600">
        <Lock className="h-8 w-8 text-candy-300" />
        <p className="font-display text-lg font-bold">Dein privates Tausch-Postfach</p>
        <p className="text-sm">
          Melde dich über <Link href="/konto" className="font-bold text-candy-600 hover:underline">dein Konto</Link>{" "}
          an, um Verhandlungen zu lesen und zu beantworten.
        </p>
      </div>
    );
  }
  if (!tauschKonfiguriert()) {
    return <p className="card-soft p-5 text-sm font-semibold text-ink-600">Das Tausch-Postfach ist noch nicht eingerichtet.</p>;
  }
  if (!tauschBereit()) {
    return (
      <p className="card-soft p-5 text-sm font-semibold text-ink-600">
        Das Tausch-Postfach wird gerade geladen – einen Moment bitte.
      </p>
    );
  }

  async function sende(angebot: TauschAngebot) {
    if (!text.trim() || sendet) return;
    setSendet(true);
    await sendePost(angebot.id, ich!.name, text);
    setText("");
    setSendet(false);
  }

  if (angebote.length === 0) {
    return (
      <div className="card-soft flex flex-col items-center gap-2 p-10 text-center text-ink-600">
        <Handshake className="h-8 w-8 text-candy-300" />
        <p className="font-display text-lg font-bold">Noch keine Tausch-Threads</p>
        <p className="text-sm">
          Geh in die <Link href="/tausch" className="font-bold text-candy-600 hover:underline">Tauschbörse</Link>{" "}
          oder auf ein Sammler-Profil und mach einem anderen einen Vorschlag.
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-[230px_1fr]">
      <div className="card-soft h-fit p-3">
        <div className="mb-2 flex items-center justify-between px-1">
          <h3 className="font-display text-sm font-bold text-ink-800">Deine Threads</h3>
          <button
            type="button"
            onClick={() => setNurOffen(!nurOffen)}
            aria-pressed={nurOffen}
            className={cn(
              "rounded-full px-2.5 py-1 text-xs font-bold transition-colors",
              nurOffen ? "bg-candy-500 text-white" : "bg-cream-100 text-ink-600 hover:bg-candy-100",
            )}
          >
            {nurOffen ? "Nur offene" : "Alle"}
          </button>
        </div>
        {angebote.map((a) => {
          const blatt = BLAETTER_NACH_ID.get(a.blattId);
          const alsAnbieter = a.anbieterId === ich.id;
          const gegenueber = alsAnbieter ? a.interessentName : a.anbieterName;
          return (
            <button
              key={a.id}
              type="button"
              onClick={() => setAuswahl(a.id)}
              className={cn(
                "mb-1 flex w-full items-center gap-2 rounded-xl px-2 py-2 text-left transition-colors",
                auswahl === a.id ? "bg-candy-100" : "hover:bg-cream-100",
              )}
            >
              <img
                src={blatt?.bild}
                alt=""
                className="h-8 w-8 shrink-0 rounded-lg bg-white object-contain ring-1 ring-cream-200"
              />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-xs font-bold text-ink-800">
                  {alsAnbieter ? "Angebot von " : "Geboten: "}
                  {gegenueber}
                </span>
                <span className="block truncate text-[10px] font-semibold text-ink-600">
                  {blatt?.name ?? blatt?.nummer ?? "Blatt"}
                </span>
              </span>
              <StatusChip status={a.status} />
            </button>
          );
        })}
      </div>

      <div className="card-soft flex flex-col">
        {!gewaehlt ? (
          <div className="flex flex-col items-center gap-2 p-10 text-center text-ink-600">
            <Handshake className="h-8 w-8 text-candy-300" />
            <p className="text-sm font-semibold">Wähle links einen Thread aus, um zu lesen und zu antworten.</p>
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-2 border-b border-candy-100 p-4">
              <StatusChip status={gewaehlt.status} />
              <p className="text-sm font-bold text-ink-800">
                {gewaehlt.anbieterName} <span className="text-ink-600">↔</span> {gewaehlt.interessentName}
              </p>
              <p className="ml-auto text-xs font-semibold text-ink-600">
                {formatiereZeit(gewaehlt.erstelltAm)}
              </p>
            </div>

            <div className="max-h-[430px] space-y-2 overflow-y-auto bg-cream-50/60 p-4">
              {nachrichten.length === 0 && (
                <p className="text-center text-xs font-semibold text-ink-600">
                  Noch keine Nachrichten in diesem Thread. Der Anbieter kennt dein Angebot bereits.
                </p>
              )}
              {nachrichten.map((m) => {
                const vonMir = m.autor === ich.name || m.autor === "";
                return (
                  <div
                    key={m.id}
                    className={cn(
                      "max-w-[85%] rounded-2xl px-3 py-2 text-sm shadow-sm",
                      vonMir
                        ? "ml-auto rounded-br-sm bg-candy-500 text-white"
                        : "mr-auto rounded-bl-sm bg-white text-ink-800 ring-1 ring-cream-200",
                    )}
                  >
                    <p className="text-[10px] font-bold opacity-70">{vonMir ? "Du" : m.autor}</p>
                    <p className="whitespace-pre-wrap break-words">{m.text}</p>
                    <p className={cn("mt-0.5 text-right text-[9px]", vonMir ? "opacity-70" : "text-ink-500")}>
                      {formatiereZeit(m.erstelltAm)}
                    </p>
                  </div>
                );
              })}
              <div ref={endeRef} />
            </div>

            {gewaehlt.status === "offen" && (
              <>
                <form
                  className="flex items-end gap-2 border-t border-candy-100 bg-white p-3"
                  onSubmit={(e) => {
                    e.preventDefault();
                    void sende(gewaehlt);
                  }}
                >
                  <input
                    value={text}
                    onChange={(e) => setText(e.target.value.slice(0, 500))}
                    placeholder="Nachricht an den Tauschpartner …"
                    className="w-full flex-1 rounded-2xl border border-cream-300 bg-white px-3 py-2 text-sm font-semibold outline-none focus:border-candy-400 focus:ring-2 focus:ring-candy-200"
                  />
                  <button
                    type="submit"
                    disabled={!text.trim() || sendet}
                    aria-label="Senden"
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-candy-500 text-white shadow-sm hover:bg-candy-600 disabled:opacity-40"
                  >
                    <Send className="h-4 w-4" />
                  </button>
                </form>

                {gewaehlt.anbieterId === ich.id ? (
                  <div className="flex gap-2 border-t border-candy-100 bg-white px-4 py-3">
                    <button
                      type="button"
                      onClick={() => void setzeAngebotStatus(gewaehlt.id, "angenommen")}
                      className="flex items-center gap-1.5 rounded-full bg-mint-200 px-4 py-2 text-sm font-bold text-emerald-800 hover:bg-mint-300"
                    >
                      <Check className="h-4 w-4" /> Annehmen
                    </button>
                    <button
                      type="button"
                      onClick={() => void setzeAngebotStatus(gewaehlt.id, "abgelehnt")}
                      className="flex items-center gap-1.5 rounded-full bg-peach-100 px-4 py-2 text-sm font-bold text-peach-600 hover:bg-peach-200"
                    >
                      <X className="h-4 w-4" /> Ablehnen
                    </button>
                  </div>
                ) : (
                  <div className="border-t border-candy-100 bg-white px-4 py-3">
                    <button
                      type="button"
                      onClick={() => void setzeAngebotStatus(gewaehlt.id, "storniert")}
                      className="rounded-full bg-white px-4 py-2 text-sm font-bold text-ink-600 ring-1 ring-cream-300 hover:bg-cream-100"
                    >
                      <Repeat2 className="mr-1 inline h-4 w-4" /> Stornieren
                    </button>
                  </div>
                )}
              </>
            )}
            {gewaehlt.status !== "offen" && (
              <div className="border-t border-candy-100 bg-white px-4 py-3 text-xs font-semibold text-ink-600">
                Dieser Thread ist abgeschlossen.
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
